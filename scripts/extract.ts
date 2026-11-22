#!/usr/bin/env tsx
/**
 * Extract the single-file Atlas (source/atlas.html) into the Astro project.
 *
 * Re-runnable: edit source/atlas.html, then `npm run extract`.
 *
 * Outputs
 *   src/content/pages/<id>.html   each section's inner HTML, byte-for-byte
 *   src/data/pages.json           page metadata (title, nav label, group, accent, lead)
 *   src/data/nav.json             nav pins + groups (labels as raw HTML, colors)
 *   src/data/redirects.json       MERGED map (old id -> page id)
 *   src/styles/atlas.css          the source <style>, minus nothing
 *   src/generated/atlas-runtime.js  the inline script, with the mechanical adaptations below
 *   public/_redirects             Cloudflare/Netlify redirects for retired ids
 *
 * Runtime adaptations (all mechanical, all listed in docs/runtime-adaptations.md):
 *   1. Page guards: top-level statements listed in src/data/guards.json are wrapped in
 *      `if(document.getElementById('<owner>')){…}`. The list comes from
 *      scripts/isolation-split-test.mjs, keyed by a SHA-1 of the statement text.
 *   2. `location.hash` reads -> ATLAS.hash(), `location.hash = x` -> ATLAS.go(x).
 *   3. Exact-text patches from scripts/runtime-patches.ts (each must match the expected count).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse as parseHTML, HTMLElement } from 'node-html-parser';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { PATCHES, COPY_PATCHES } from './runtime-patches.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'source/atlas.html');
const out = (p: string) => path.join(ROOT, p);
const write = (p: string, data: string) => { fs.mkdirSync(path.dirname(out(p)), { recursive: true }); fs.writeFileSync(out(p), data); };

const html = fs.readFileSync(SRC, 'utf8');
const sourceSha = crypto.createHash('sha1').update(html).digest('hex');
const root = parseHTML(html, { comment: true, blockTextElements: { script: true, style: true } });
const text = (el: HTMLElement | null) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');

/* ---------------- pages ---------------- */
const main = root.querySelector('main')!;
const sections = main.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === 'SECTION');
fs.rmSync(out('src/content/pages'), { recursive: true, force: true });
const nav = root.querySelector('#nav')!;

type NavItem = { id: string; label: string; title: string; color: string; dataLabel?: string; icon?: string; hidden?: boolean };
const colorOf = (a: HTMLElement) => (a.getAttribute('style') || '').match(/--c:var\(--([a-z]+)\)/)?.[1] || 'ink';
const pins: NavItem[] = nav.querySelectorAll('.navpins a').map((a) => ({
  id: a.getAttribute('href')!.slice(1),
  label: a.innerHTML.trim(),
  title: a.getAttribute('title') || '',
  dataLabel: a.getAttribute('data-label') || '',
  color: colorOf(a),
}));
// Decision 4: Team mode stays in the code but leaves the nav and the sitemap.
const HIDDEN_FROM_NAV = new Set(['team']);
const groups = nav.querySelectorAll('li.grp').map((li) => ({
  name: li.querySelector('.gname')!.innerHTML.trim(),
  items: li.querySelectorAll('ul a').map((a) => ({
    id: a.getAttribute('href')!.slice(1),
    label: a.innerHTML.replace(/^<i><\/i>/, '').trim(),
    title: a.getAttribute('title') || '',
    color: colorOf(a),
    ...(HIDDEN_FROM_NAV.has(a.getAttribute('href')!.slice(1)) ? { hidden: true } : {}),
  })),
}));
const shell = {
  brand: root.querySelector('aside .brand')!.toString(),
  navtools: root.querySelector('aside .navtools')!.toString(),
  navfoot: root.querySelector('aside .navfoot')!.toString(),
  coursebar: root.querySelector('#coursebar')!.toString(),
};
write('src/data/nav.json', JSON.stringify({ pins, groups, shell }, null, 1));

const navLabel: Record<string, string> = {};
const navGroup: Record<string, string> = {};
const decode = (s: string) => parseHTML(s).text.replace(/\s+/g, ' ').trim();
pins.forEach((p) => { navLabel[p.id] = (p.dataLabel || decode(p.label)).replace(/^[^\w(]+/, '').trim(); navGroup[p.id] = ''; });
groups.forEach((g) => g.items.forEach((it) => { navLabel[it.id] ??= decode(it.label); navGroup[it.id] ||= decode(g.name); }));

const pages = sections.map((s) => {
  const open = html.slice(s.range[0], html.indexOf('>', s.range[0]) + 1);
  const inner = html.slice(html.indexOf('>', s.range[0]) + 1, s.range[1] - '</section>'.length);
  if (!html.slice(s.range[1] - 10, s.range[1]).startsWith('</section>')) throw new Error('section end not found for ' + s.id);
  let content = inner;
  for (const p of COPY_PATCHES.filter((p) => p.in === 'content' && p.page === s.id)) {
    const n = content.split(p.find).length - 1;
    if (n !== (p.count ?? 1)) throw new Error(`content patch "${p.id}" expected ${p.count ?? 1} match(es) on ${s.id}, found ${n}`);
    content = content.split(p.find).join(p.replace);
  }
  write(`src/content/pages/${s.id}.html`, content);
  const h1 = s.querySelector('h1');
  return {
    id: s.id,
    title: text(h1) || navLabel[s.id] || s.id,
    navLabel: navLabel[s.id] || null,
    group: navGroup[s.id] || null,
    inNav: s.id in navLabel && !HIDDEN_FROM_NAV.has(s.id),
    accent: open.match(/--accent:var\(--([a-z]+)\)/)?.[1] || 'blue',
    lead: text(s.querySelector('p.lead')),
    kicker: text(s.querySelector(':scope > .kicker')),
  };
});
write('src/data/pages.json', JSON.stringify(pages, null, 1));
// The boot script only needs ids and labels.
write('src/generated/boot-pages.json', JSON.stringify(pages.map((p) => ({ id: p.id, title: p.title, navLabel: p.navLabel, group: p.group }))));

/* ---------------- merged ids ---------------- */
const MERGED: Record<string, string> = JSON.parse(html.match(/const MERGED=(\{[^}]*\})/)![1]);
write('src/data/redirects.json', JSON.stringify(MERGED, null, 1));
const pageUrl = (id: string) => (id === 'overview' ? '/' : `/${id}/`);
write('public/_redirects',
  '# Generated by scripts/extract.ts. Retired page ids now live inside another page.\n' +
  '/overview/ / 301\n' +
  Object.entries(MERGED).map(([o, n]) => `/${o}/ ${pageUrl(n)}#${o} 301`).join('\n') + '\n');

/* ---------------- CSS ---------------- */
const styleEls = root.querySelectorAll('style');
if (styleEls.length !== 1) throw new Error('expected one <style>');
write('src/styles/atlas.css', '/* Extracted verbatim from source/atlas.html by scripts/extract.ts. Do not edit; edit the source and re-run. */\n' + styleEls[0].rawText);

/* ---------------- runtime JS ---------------- */
const scriptEls = root.querySelectorAll('script');
if (scriptEls.length !== 1) throw new Error('expected one <script>');
const code = scriptEls[0].rawText;
const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true }) as any;

type Edit = { start: number; end: number; text: string; kind: string };
const edits: Edit[] = [];

// 1. guards
const guards = JSON.parse(fs.readFileSync(out('src/data/guards.json'), 'utf8'));
if (guards.sourceSha !== sourceSha) console.warn('! src/data/guards.json was computed for a different source. Run `npm run extract:analyze`.');
const bySha = new Map<string, string>(guards.guards.map((g: any) => [g.sha, g.owner]));
let guarded = 0;
for (const st of ast.body) {
  const sha = crypto.createHash('sha1').update(code.slice(st.start, st.end)).digest('hex');
  const owner = bySha.get(sha);
  if (!owner) continue;
  if (st.type !== 'ExpressionStatement') throw new Error('guard on non-expression statement at ' + st.loc.start.line);
  edits.push({ start: st.start, end: st.start, text: `if(document.getElementById(${JSON.stringify(owner)})){`, kind: 'guard' });
  edits.push({ start: st.end, end: st.end, text: '}', kind: 'guard' });
  guarded++;
}
const missingGuards = guards.guards.length - guarded;
if (missingGuards) console.warn(`! ${missingGuards} guard(s) in guards.json no longer match a statement. Run \`npm run extract:analyze\`.`);

// 3. text patches (collected before hash rewrites so they can override them)
for (const p of PATCHES) {
  let idx = -1, n = 0;
  const found: number[] = [];
  while ((idx = code.indexOf(p.find, idx + 1)) !== -1) { found.push(idx); n++; }
  if (n !== (p.count ?? 1)) throw new Error(`patch "${p.id}" expected ${p.count ?? 1} match(es), found ${n}`);
  found.forEach((i) => edits.push({ start: i, end: i + p.find.length, text: p.replace, kind: 'patch:' + p.id }));
}

// 2. location.hash
let hashReads = 0, hashWrites = 0;
walk.ancestor(ast, {
  MemberExpression(n: any, _s: any, anc: any[]) {
    if (n.computed || n.object.type !== 'Identifier' || n.object.name !== 'location' || n.property.name !== 'hash') return;
    const parent = anc[anc.length - 2];
    if (parent && parent.type === 'AssignmentExpression' && parent.left === n) {
      if (parent.operator !== '=') throw new Error('unsupported location.hash operator');
      edits.push({ start: parent.start, end: parent.right.start, text: 'ATLAS.go(', kind: 'hash-write' });
      edits.push({ start: parent.end, end: parent.end, text: ')', kind: 'hash-write' });
      hashWrites++;
    } else {
      edits.push({ start: n.start, end: n.end, text: 'ATLAS.hash()', kind: 'hash-read' });
      hashReads++;
    }
  },
});

// apply: a patch range swallows any hash edit inside it; guards sit on statement boundaries
const patchRanges = edits.filter((e) => e.kind.startsWith('patch:'));
const inPatch = (e: Edit) => !e.kind.startsWith('patch:') && patchRanges.some((p) => e.start >= p.start && e.end <= p.end && !(e.kind === 'guard'));
const live = edits.filter((e) => !inPatch(e)).sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
let js = '', pos = 0;
for (const e of live) {
  if (e.start < pos) throw new Error(`overlapping edits at ${e.start} (${e.kind})`);
  js += code.slice(pos, e.start) + e.text;
  pos = e.end;
}
js += code.slice(pos);
// The transformed code must still parse.
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' });
write('src/generated/atlas-runtime.js',
  `/* Generated by scripts/extract.ts from source/atlas.html (sha1 ${sourceSha.slice(0, 12)}). Do not edit. */\n` + js);

/* ---------------- report ---------------- */
const pc = PATCHES.map((p) => `${p.id}×${p.count ?? 1}`).join(', ');
const report = {
  sourceSha, pages: pages.length, merged: Object.keys(MERGED).length, guards: guarded,
  hashReads, hashWrites, patches: PATCHES.length,
};
write('src/generated/extract-report.json', JSON.stringify(report, null, 1));
console.log(`extracted ${pages.length} pages · ${Object.keys(MERGED).length} merged ids · ${guarded} guards · location.hash ${hashReads} reads / ${hashWrites} writes · patches: ${pc}`);
