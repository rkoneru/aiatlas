#!/usr/bin/env node
// Phase 0 dynamic check, finer-grained: the single inline script is split into one classic
// <script> per top-level statement (classic scripts share one global scope, and an error in
// one does not stop the next). Each page is loaded with only its own <main> section and the
// failing statements are recorded. Output: docs/isolation-split.json
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse as parseHTML } from 'node-html-parser';
import * as acorn from 'acorn';
import { chromium } from 'playwright';

const html0 = fs.readFileSync('source/atlas.html', 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
const sStart = html0.indexOf('<script>') + 8, sEnd = html0.lastIndexOf('</script>');
const code = html0.slice(sStart, sEnd);
const scriptLine0 = html0.slice(0, sStart).split('\n').length;
const ast = acorn.parse(code, { ecmaVersion: 'latest', locations: true });
const stmts = ast.body.map((st, i) => ({ i, line: scriptLine0 + st.loc.start.line - 1, src: code.slice(st.start, st.end) }));
// Top-level function declarations hoist across the whole original script, so they go first.
const isFn = (i) => ast.body[i].type === 'FunctionDeclaration';
const tag = (s) => `<script>${s.src.replace(/<\/script/gi, '<\\/script')}\n//# sourceURL=stmt-${s.i}.js\n</script>`;
const split = [...stmts.filter((s) => isFn(s.i)), ...stmts.filter((s) => !isFn(s.i))].map(tag).join('\n');
const html = html0.slice(0, sStart - 8) + split + html0.slice(sEnd + 9);

const root = parseHTML(html, { blockTextElements: { script: true, style: true } });
const secs = root.querySelector('main').childNodes.filter((n) => n.tagName === 'SECTION');
function variant(keep) { let out = '', last = 0; for (const s of secs) { const [a, b] = s.range; out += html.slice(last, a); if (s.id === keep) out += html.slice(a, b); last = b; } return out + html.slice(last); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-split-'));
const browser = await chromium.launch();
async function run(file, hash) {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => { const m = (e.stack || '').match(/stmt-(\d+)\.js/); errs.push({ stmt: m ? +m[1] : null, msg: (e.message || '').split('\n')[0] }); });
  page.on('console', (m) => { if (m.type() === 'error') errs.push({ stmt: null, msg: 'console: ' + m.text().split('\n')[0] }); });
  await page.goto('file://' + file + '#' + hash, { waitUntil: 'load' }); await page.waitForTimeout(800);
  await ctx.close(); return errs;
}
const full = path.join(tmp, 'full.html'); fs.writeFileSync(full, html);
const fullErrs = {}; for (const s of secs) { const e = await run(full, s.id); if (e.length) fullErrs[s.id] = e; }
const iso = {};
for (const s of secs) { const f = path.join(tmp, s.id + '.html'); fs.writeFileSync(f, variant(s.id)); iso[s.id] = await run(f, s.id); }
await browser.close();
const byStmt = {};
for (const [pg, es] of Object.entries(iso)) for (const e of es) { const k = e.stmt; (byStmt[k] ||= { stmt: k, line: k != null ? stmts[k].line : null, head: k != null ? stmts[k].src.slice(0, 90).replace(/\s+/g, ' ') : '', msgs: new Set(), pages: new Set() }); byStmt[k].msgs.add(e.msg); byStmt[k].pages.add(pg); }
const rows = Object.values(byStmt).map((r) => ({ ...r, msgs: [...r.msgs], pages: [...r.pages].length, okOn: secs.map((x) => x.id).filter((id) => !r.pages.has(id)) })).sort((a, b) => (a.line || 0) - (b.line || 0));
fs.writeFileSync('docs/isolation-split.json', JSON.stringify({ statements: stmts.length, fullFileErrors: fullErrs, failingStatements: rows, perPage: Object.fromEntries(Object.entries(iso).map(([k, v]) => [k, v.length])) }, null, 1));
console.log('top-level statements:', stmts.length, '| full-file errors after split:', Object.keys(fullErrs).length, '| failing statements on isolated pages:', rows.length);
const pp = Object.values(iso).map((v) => v.length); console.log('errors per isolated page: min', Math.min(...pp), 'max', Math.max(...pp));
