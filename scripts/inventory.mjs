#!/usr/bin/env node
// Phase 0 inventory: static analysis of source/atlas.html.
// Writes docs/inventory.md and docs/inventory.json. Read-only with respect to the source.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseHTML } from 'node-html-parser';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const SRC = process.argv[2] || 'source/atlas.html';
const html = fs.readFileSync(SRC, 'utf8');
const lines = html.split('\n');
const lineOf = (idx) => html.slice(0, idx).split('\n').length;

/* ---------- HTML structure ---------- */
const root = parseHTML(html, { comment: false, blockTextElements: { script: true, style: true } });
const main = root.querySelector('main');
const nav = root.querySelector('#nav');
const text = (el) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');

const navGroups = [];
const pageGroup = {};
const navLabel = {};
for (const a of nav.querySelectorAll('.navpins a')) {
  const id = a.getAttribute('href').slice(1);
  navLabel[id] = a.getAttribute('data-label') || text(a);
  pageGroup[id] = pageGroup[id] || 'Pinned';
}
for (const li of nav.querySelectorAll('li.grp')) {
  const g = text(li.querySelector('.gname'));
  const items = li.querySelectorAll('ul a').map((a) => a.getAttribute('href').slice(1));
  navGroups.push({ group: g, pages: items });
  for (const a of li.querySelectorAll('ul a')) {
    const id = a.getAttribute('href').slice(1);
    navLabel[id] = text(a);
    pageGroup[id] = pageGroup[id] && pageGroup[id] !== 'Pinned' ? pageGroup[id] : g;
  }
}

const sections = main.childNodes.filter((n) => n.tagName === 'SECTION');
const elOwner = {}; // element id -> section id
const shellIds = new Set();
for (const el of root.querySelectorAll('[id]')) {
  let p = el, sec = null;
  while (p) { if (p.tagName === 'SECTION' && p.parentNode === main) { sec = p.id; break; } p = p.parentNode; }
  if (sec) elOwner[el.id] = sec; else shellIds.add(el.id);
}

const pages = sections.map((s) => {
  const h1 = s.querySelector('h1');
  const lead = s.querySelector('p.lead');
  const flows = s.querySelectorAll('[data-flow]').map((e) => e.getAttribute('data-flow'));
  const merged = s.querySelectorAll('.merged').map((e) => e.id);
  const ctrls = s.querySelectorAll('input,select,textarea,button');
  const canvases = s.querySelectorAll('canvas').length;
  return {
    id: s.id,
    title: text(h1) || navLabel[s.id] || '',
    navLabel: navLabel[s.id] || null,
    group: pageGroup[s.id] || null,
    inNav: !!navLabel[s.id],
    accent: (s.getAttribute('style') || '').match(/--accent:var\(--([a-z]+)\)/)?.[1] || null,
    lead: text(lead).slice(0, 200),
    flows,
    merged,
    staticControls: ctrls.length,
    canvases,
    bytes: s.innerHTML.length,
    tools: [], // filled from script blocks
  };
});
const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));

/* ---------- scripts ---------- */
// Real <script> elements only (template-literal copies inside JS are skipped by the parser).
const scriptEls = root.querySelectorAll('script');
const scripts = scriptEls.map((s) => {
  const code = s.rawText;
  const start = html.indexOf(code);
  return { code, startLine: lineOf(start), offset: start };
});
const styleEls = root.querySelectorAll('style');

const S = scripts[0];
const ast = acorn.parse(S.code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
const absLine = (loc) => S.startLine + loc.line - 1;

// Blocks: split by top-level header comments  /* ---------- X ---------- */  or /* ===== X ===== */
const headers = [];
lines.forEach((l, i) => {
  const ln = i + 1;
  if (ln < S.startLine) return;
  const m = l.match(/^\s*\/\*\s*([-=]{3,})\s*(.*?)\s*[-=]{3,}\s*\*\//);
  if (m) headers.push({ line: ln, title: m[2], major: m[1].length >= 5 || /^RELEASE|^release/.test(m[2]) });
});
const blockAt = (ln) => { let b = null; for (const h of headers) { if (h.line <= ln) b = h; else break; } return b ? `${b.title} (L${b.line})` : `prelude (L${S.startLine})`; };

// Top-level declarations
const globals = [];
for (const st of ast.body) {
  const ln = absLine(st.loc.start);
  if (st.type === 'VariableDeclaration') for (const d of st.declarations) {
    const names = [];
    walk.full(d.id, (n) => { if (n.type === 'Identifier') names.push(n.name); });
    names.forEach((name) => globals.push({ name, kind: st.kind, line: ln, block: blockAt(ln) }));
  } else if (st.type === 'FunctionDeclaration') globals.push({ name: st.id.name, kind: 'function', line: ln, block: blockAt(ln) });
  else if (st.type === 'ClassDeclaration') globals.push({ name: st.id.name, kind: 'class', line: ln, block: blockAt(ln) });
}
// window.X = … assignments anywhere
const windowProps = [];
walk.simple(ast, {
  AssignmentExpression(n) {
    if (n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && n.left.object.name === 'window' && !n.left.computed)
      windowProps.push({ name: 'window.' + n.left.property.name, line: absLine(n.loc.start), block: blockAt(absLine(n.loc.start)) });
  },
});

// Global usage across blocks (identifier references to top-level names)
const gnames = new Map(globals.map((g) => [g.name, g]));
const usage = new Map(); // name -> Set(block)
walk.fullAncestor(ast, (n, _st, anc) => {
  if (n.type !== 'Identifier' || !gnames.has(n.name)) return;
  const parent = anc[anc.length - 2];
  if (parent && parent.type === 'MemberExpression' && parent.property === n && !parent.computed) return;
  if (parent && parent.type === 'Property' && parent.key === n && !parent.computed && !parent.shorthand) return;
  const b = blockAt(absLine(n.loc.start));
  if (!usage.has(n.name)) usage.set(n.name, new Set());
  usage.get(n.name).add(b);
});

/* ---------- DOM lookups with literal ids, and eager vs lazy context ---------- */
const ITER = new Set(['forEach', 'map', 'filter', 'some', 'every', 'reduce', 'find', 'findIndex', 'flatMap', 'sort']);
function literalId(call) {
  const c = call.callee, a = call.arguments[0];
  if (!a || a.type !== 'Literal' || typeof a.value !== 'string') return null;
  if (c.type === 'Identifier' && c.name === '$') return a.value;
  if (c.type === 'MemberExpression' && !c.computed) {
    const p = c.property.name;
    if (p === 'getElementById') return a.value;
    if ((p === 'querySelector' || p === 'querySelectorAll')) { const m = a.value.match(/^#([\w-]+)/); return m ? m[1] : null; }
  }
  return null;
}
// eager = reachable while the script first runs (top level, IIFEs, array-iterator callbacks).
function isEagerFn(fnNode, anc) {
  const parent = anc[anc.length - 2];
  if (!parent) return false;
  if (parent.type === 'CallExpression' && parent.callee === fnNode) return true; // IIFE
  if (parent.type === 'CallExpression' && parent.arguments.includes(fnNode)) {
    const c = parent.callee;
    if (c.type === 'MemberExpression' && !c.computed && ITER.has(c.property.name)) return true;
  }
  return false;
}
const domRefs = [];
walk.fullAncestor(ast, (n, _st, anc) => {
  if (n.type !== 'CallExpression') return;
  const id = literalId(n);
  if (!id) return;
  let eager = true;
  for (let i = anc.length - 2; i >= 0; i--) {
    const a = anc[i];
    if (/Function/.test(a.type) && !isEagerFn(a, anc.slice(0, i + 1))) { eager = false; break; }
    if (a.type === 'MethodDefinition' || a.type === 'PropertyDefinition') { eager = false; break; }
  }
  const ln = absLine(n.loc.start);
  domRefs.push({ id, line: ln, block: blockAt(ln), eager, owner: elOwner[id] || (shellIds.has(id) ? '(shell)' : '(created by JS)') });
});

// Per block: pages touched
const blockPages = new Map();
for (const r of domRefs) {
  if (!blockPages.has(r.block)) blockPages.set(r.block, new Set());
  if (!r.owner.startsWith('(')) blockPages.get(r.block).add(r.owner);
}
for (const [b, ps] of blockPages) if (ps.size === 1) { const p = pageById[[...ps][0]]; if (p && !p.tools.includes(b)) p.tools.push(b); }
// also tools for pages through flows/keys: attach blocks that reference ≥2 pages too
for (const [b, ps] of blockPages) if (ps.size > 1) for (const id of ps) { const p = pageById[id]; if (p && !p.tools.includes(b)) p.tools.push(b + ' [multi-page]'); }

/* ---------- capabilities ---------- */
const caps = [];
walk.fullAncestor(ast, (n) => {
  if (n.type !== 'CallExpression') return;
  const c = n.callee;
  if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'use' &&
      c.object.type === 'MemberExpression' && c.object.property && c.object.property.name === 'claude') {
    const a = n.arguments[0];
    const ln = absLine(n.loc.start);
    caps.push({ cap: a && a.type === 'Literal' ? a.value : '?', line: ln, block: blockAt(ln) });
  }
});
// sample() consumers: calls of sample/SAMPLE/s(.json)? with string/array first arg — reported by grep for review
const sampleCalls = [];
lines.forEach((l, i) => {
  const ln = i + 1;
  if (ln < S.startLine) return;
  const re = /\b(sample|SAMPLE|s)(\.json)?\((?=[`'"\[a-zA-Z(])/g; let m;
  while ((m = re.exec(l))) {
    const after = l.slice(m.index, m.index + 400);
    if (m[1] === 's' && !m[2]) continue; // too ambiguous
    if (m[1] === 'sample' && !m[2] && /function sample\(|sample\(\);/.test(l.slice(Math.max(0, m.index - 9), m.index + 9))) continue;
    if (m[1] === 'SAMPLE' && /SAMPLE\(\)/.test(after.slice(0, 8))) continue;
    const opts = after.match(/\{(?:signal|modelTier|cache|onText)[^}]*\}/);
    sampleCalls.push({ line: ln, fn: m[1] + (m[2] || ''), block: blockAt(ln), opts: opts ? opts[0] : '' });
  }
});

/* ---------- localStorage keys ---------- */
const keys = new Map();
const keyRe = /['"`](atlas-[\w-]+)['"`]/g;
lines.forEach((l, i) => { let m; keyRe.lastIndex = 0; while ((m = keyRe.exec(l))) { const ln = i + 1; if (ln < S.startLine) continue; if (!keys.has(m[1])) keys.set(m[1], []); keys.get(m[1]).push(ln); } });
const keyUse = [...keys].map(([k, ls]) => ({ key: k, lines: [...new Set(ls)], blocks: [...new Set(ls.map(blockAt))] }));
const lsAccessRe = /(local|session)Storage\.(getItem|setItem|removeItem|clear|key)\(/g;
let lsAccess = 0; lines.forEach((l) => { lsAccess += (l.match(lsAccessRe) || []).length; });

/* ---------- data tables ---------- */
const dataTables = ['MERGED', 'DEFS', 'CMOD', 'CQ', 'AC', 'AC_CATS', 'GL', 'PATHS', 'FM', 'CHANGES', 'REVIEW', 'FLOWS', 'ROLES', 'PATS', 'RAGV', 'WF', 'TS', 'LT', 'LW', 'RC'];
const tableInfo = dataTables.map((name) => {
  const re = new RegExp(`\\b(const|let|var)\\s+${name}\\s*=`);
  const ln = lines.findIndex((l) => re.test(l)) + 1;
  const g = globals.find((x) => x.name === name);
  return { name, line: ln || null, topLevel: !!g, block: ln ? blockAt(ln) : null };
});

const MERGED = JSON.parse(html.match(/const MERGED=(\{[^}]*\})/)[1]);

/* ---------- output ---------- */
const out = {
  source: SRC, bytes: html.length, lines: lines.length,
  scripts: scripts.map((s) => ({ startLine: s.startLine, bytes: s.code.length })),
  styles: styleEls.map((s) => ({ startLine: lineOf(html.indexOf(s.rawText)), bytes: s.rawText.length })),
  pages, navGroups, MERGED, globals, windowProps, caps, sampleCalls, keyUse, tableInfo,
  domRefs, headers,
};
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/inventory.json', JSON.stringify(out, null, 1));

const md = [];
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
md.push('# AI Architecture Atlas — inventory (Phase 0)', '');
md.push(`Generated by \`npm run inventory\` from \`${SRC}\` (${(html.length / 1024).toFixed(0)} KB, ${lines.length} lines). Machine-readable copy: \`docs/inventory.json\`. Findings and blockers are written by hand in \`docs/inventory-findings.md\`.`, '');
md.push('## File structure', '');
md.push(`- ${styleEls.length} \`<style>\` element(s): ${out.styles.map((s) => `L${s.startLine} (${(s.bytes / 1024).toFixed(0)} KB)`).join(', ')}`);
md.push(`- ${scripts.length} \`<script>\` element(s): ${out.scripts.map((s) => `L${s.startLine} (${(s.bytes / 1024).toFixed(0)} KB)`).join(', ')}. Other \`<script>\`/\`<style>\` text in the file sits inside JS template literals (export/slide/proposal generators) and is not executed on load.`);
md.push(`- ${pages.length} pages (\`main > section\`), ${Object.keys(MERGED).length} merged-page aliases, ${navGroups.length} nav groups + ${nav.querySelectorAll('.navpins a').length} pinned links.`);
md.push(`- External resources: Google Fonts stylesheet (Inter 400–800, JetBrains Mono 400/600) — must be self-hosted.`, '');

md.push('## Pages', '');
md.push('| # | id | title | nav group | flows (`data-flow`) | merged blocks | static controls | page-specific script blocks |');
md.push('|---|---|---|---|---|---|---|---|');
pages.forEach((p, i) => md.push(`| ${i + 1} | \`${p.id}\` | ${esc(p.title)} | ${esc(p.group || '— (not in nav)')} | ${p.flows.map((f) => '`' + f + '`').join(' ') || '—'} | ${p.merged.map((f) => '`' + f + '`').join(' ') || '—'} | ${p.staticControls} | ${esc(p.tools.join('; ')) || '—'} |`));
md.push('');
const notInNav = pages.filter((p) => !p.inNav).map((p) => '`' + p.id + '`');
md.push(`Pages not linked from the nav: ${notInNav.join(', ') || 'none'}.`, '');
md.push('"Static controls" counts inputs/buttons present in the HTML; many tools render their controls from JS, so the script-block column is the better guide to what is interactive.', '');

md.push('## Merged page aliases (`MERGED`)', '');
md.push('| old id | now on page | block present |', '|---|---|---|');
for (const [o, n] of Object.entries(MERGED)) md.push(`| \`${o}\` | \`${n}\` | ${elOwner[o] === n ? 'yes' : '**no** (' + (elOwner[o] || 'missing') + ')'} |`);
md.push('');

md.push('## `window.claude.use` call sites', '');
md.push('| line | capability | block |', '|---|---|---|');
caps.forEach((c) => md.push(`| ${c.line} | \`${c.cap}\` | ${esc(c.block)} |`));
md.push('');
md.push('### `sample` consumers (calls of the resolved sampler)', '');
md.push('| line | call | block | options seen |', '|---|---|---|---|');
sampleCalls.forEach((c) => md.push(`| ${c.line} | \`${c.fn}()\` | ${esc(c.block)} | ${esc(c.opts) || '—'} |`));
md.push('');

md.push('## `localStorage` keys', '');
md.push(`${lsAccess} direct \`localStorage\` calls. All keys are string literals with the \`atlas-\` prefix (some are passed through local helpers such as \`const K='atlas-…'\`).`, '');
md.push('| key | lines | blocks |', '|---|---|---|');
keyUse.sort((a, b) => a.key.localeCompare(b.key)).forEach((k) => md.push(`| \`${k.key}\` | ${k.lines.join(', ')} | ${esc(k.blocks.join('; '))} |`));
md.push('');

md.push('## Large data tables', '');
md.push('| name | line | top-level global | block |', '|---|---|---|---|');
tableInfo.forEach((t) => md.push(`| \`${t.name}\` | ${t.line || '—'} | ${t.line ? (t.topLevel ? 'yes' : 'no (inside a closure)') : '—'} | ${esc(t.block || 'not found')} |`));
md.push('');

md.push('## Globals defined by the inline script', '');
md.push('Top-level `const`/`let`/`function`/`class` declarations of the single classic script (they share one global lexical scope). "Used in" lists every script block that references the name.', '');
md.push('| name | kind | line | defined in | used in other blocks |', '|---|---|---|---|---|');
for (const g of globals) {
  const u = [...(usage.get(g.name) || [])].filter((b) => b !== g.block);
  md.push(`| \`${g.name}\` | ${g.kind} | ${g.line} | ${esc(g.block)} | ${u.length ? esc(u.join('; ')) : '—'} |`);
}
md.push('');
md.push('### Properties assigned on `window`', '');
md.push(windowProps.map((w) => `- \`${w.name}\` (L${w.line}, ${w.block})`).join('\n') || '- none', '');

md.push('## Script blocks: shared vs page-specific', '');
md.push('A block is the code between two header comments. "Pages" lists the sections that own the element ids the block looks up by literal id (`getElementById`, `$()`, `querySelector(\'#…\')`).', '');
md.push('| block | pages whose DOM it touches | classification |', '|---|---|---|');
const seen = new Set();
for (const h of [{ line: S.startLine, title: 'prelude' }, ...headers]) {
  const b = h.title === 'prelude' ? `prelude (L${S.startLine})` : `${h.title} (L${h.line})`;
  if (seen.has(b)) continue; seen.add(b);
  const ps = [...(blockPages.get(b) || [])];
  const shell = domRefs.some((r) => r.block === b && r.owner === '(shell)');
  const cls = ps.length === 0 ? (shell ? 'shared (shell only)' : 'shared / data / no literal DOM ids') : ps.length === 1 ? 'page-specific' : 'multi-page';
  md.push(`| ${esc(b)} | ${ps.map((p) => '`' + p + '`').join(' ') || '—'} | ${cls} |`);
}
md.push('');

md.push('## Eager lookups of another page\'s DOM', '');
md.push('Literal-id lookups that run while the script first loads (top level, inside IIFEs or array-iterator callbacks), for ids that live inside a page section. On a site where only one section is in the HTML these return `null` on every other page; they need a guard. Dynamic results (what actually throws) are in `docs/inventory-findings.md`.', '');
const eagerX = domRefs.filter((r) => r.eager && !r.owner.startsWith('('));
const byBlock = {};
eagerX.forEach((r) => { (byBlock[r.block] ||= new Set()).add(`${r.id}→${r.owner}`); });
md.push('| block | eager ids (→ owning page) |', '|---|---|');
for (const [b, s] of Object.entries(byBlock)) md.push(`| ${esc(b)} | ${[...s].map((x) => '`' + x + '`').join(' ')} |`);
md.push('');

fs.writeFileSync('docs/inventory.md', md.join('\n'));
console.log(`pages=${pages.length} merged=${Object.keys(MERGED).length} globals=${globals.length} caps=${caps.length} sampleCalls=${sampleCalls.length} keys=${keyUse.length} eagerCrossRefs=${eagerX.length} blocks=${headers.length}`);
