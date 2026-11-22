#!/usr/bin/env node
// Phase 0: how much of each page's text exists in the static HTML vs only after JS runs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse as parseHTML } from 'node-html-parser';
import { chromium } from 'playwright';
const html = fs.readFileSync('source/atlas.html', 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
const root = parseHTML(html, { blockTextElements: { script: true, style: true } });
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const stat = {};
for (const s of root.querySelector('main').childNodes.filter((n) => n.tagName === 'SECTION')) stat[s.id] = norm(s.text).length;
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cov-')), 'a.html'); fs.writeFileSync(f, html);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + f); await p.waitForTimeout(1500);
const dyn = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('main>section')].map((s) => { const c = s.cloneNode(true); c.querySelectorAll('svg,script,style,.ptools,.fctl,.expmenu,.src-box,.pa-top').forEach((x) => x.remove()); return [s.id, c.textContent.replace(/\s+/g, ' ').trim().length]; })));
await b.close();
const rows = Object.keys(dyn).map((id) => ({ id, static: stat[id] || 0, rendered: dyn[id], pct: dyn[id] ? Math.round((100 * (stat[id] || 0)) / dyn[id]) : 100 }));
fs.writeFileSync('docs/render-coverage.json', JSON.stringify(rows, null, 1));
rows.sort((a, b) => a.pct - b.pct);
console.log('pages where <50% of text is in static HTML:', rows.filter((r) => r.pct < 50).length);
console.log(rows.slice(0, 25).map((r) => `${r.id}:${r.pct}%`).join(' '));
