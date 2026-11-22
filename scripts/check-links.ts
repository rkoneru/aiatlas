#!/usr/bin/env tsx
/**
 * Internal link check over dist/:
 *  - every href="/…" resolves to a built page or a _redirects rule
 *  - every #fragment resolves to an element id on the target page
 *  - every remaining href="#…" points at an element on the same page
 * Links the runtime builds in JS (#page-id) are covered by the e2e tests and the
 * boot script's click handler; this checks the HTML as served.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';

const DIST = path.resolve(process.argv[2] || 'dist');
// Base path the site was built with (ATLAS_BASE), e.g. /aiatlas/ for GitHub Pages.
const BASE = ('/' + (process.argv[3] || process.env.ATLAS_BASE || '').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
const files: string[] = [];
(function walk(d: string) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) files.push(p); } })(DIST);

const route = (f: string) => '/' + path.relative(DIST, f).replace(/index\.html$/, '').replace(/\\/g, '/');
const ids = new Map<string, Set<string>>();
const docs = new Map<string, ReturnType<typeof parse>>();
for (const f of files) {
  const doc = parse(fs.readFileSync(f, 'utf8'));
  docs.set(route(f), doc);
  // ids in <template> companions are not part of the page; skip them
  const set = new Set<string>();
  doc.querySelectorAll('[id]').forEach((el) => { let p: any = el; while (p && p.rawTagName !== 'template') p = p.parentNode; if (!p) set.add(el.id); });
  ids.set(route(f), set);
}
const redirects = new Map<string, string>();
const rf = path.join(DIST, '_redirects');
if (fs.existsSync(rf)) for (const l of fs.readFileSync(rf, 'utf8').split('\n')) { const m = l.match(/^(\/\S*)\s+(\S+)\s+\d+/); if (m) redirects.set(m[1], m[2]); }

const problems: string[] = [];
let checked = 0;
for (const [from, doc] of docs) {
  for (const a of doc.querySelectorAll('[href]')) {
    let inTemplate: any = a; while (inTemplate && inTemplate.rawTagName !== 'template') inTemplate = inTemplate.parentNode;
    if (inTemplate) continue;
    const href = a.getAttribute('href')!;
    if (/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(href) || href.startsWith('//')) continue;
    if (a.rawTagName === 'link') continue;
    checked++;
    let [p, frag] = href.split('#');
    if (p && BASE !== '/') { if (!p.startsWith(BASE)) { problems.push(`${from}: ${href} is outside the base path ${BASE}`); continue; } p = '/' + p.slice(BASE.length); }
    if (!p) { if (frag && !ids.get(from)!.has(decodeURIComponent(frag))) problems.push(`${from}: #${frag} has no target on the page`); continue; }
    if (redirects.has(p) && BASE === '/') { const t = redirects.get(p)!; [p, frag] = t.split('#'); }
    if (!p.endsWith('/') && !path.extname(p)) { problems.push(`${from}: ${href} lacks a trailing slash`); continue; }
    if (path.extname(p)) { if (!fs.existsSync(path.join(DIST, p))) problems.push(`${from}: ${href} not found`); continue; }
    if (!ids.has(p)) { problems.push(`${from}: ${href} → no page`); continue; }
    if (frag && !ids.get(p)!.has(decodeURIComponent(frag))) problems.push(`${from}: ${href} → no #${frag} on ${p}`);
  }
}
console.log(`checked ${checked} internal links on ${files.length} pages`);
if (problems.length) { console.error(problems.slice(0, 100).join('\n')); console.error(`${problems.length} broken link(s)`); process.exit(1); }
console.log('no broken internal links');
