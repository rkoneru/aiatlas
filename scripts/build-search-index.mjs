#!/usr/bin/env node
// Builds public/search-index.json from the *rendered* original (source/atlas.html in headless
// Chromium), using the same text extraction as the Atlas's own secText() and navLabel().
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

const html = fs.readFileSync('source/atlas.html', 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-idx-')), 'atlas.html');
fs.writeFileSync(f, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + f);
await page.waitForTimeout(1500);
const idx = await page.evaluate(() => {
  // Same as secText() and navLabel() in the Atlas runtime (release 13 block).
  const secText = (sec) => { const c = sec.cloneNode(true); c.querySelectorAll('svg,script,style,.ptools,.fctl,.expmenu,select,.ask-panel').forEach((x) => x.remove());
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = tw.nextNode())) out.push(n.nodeValue);
    return out.join(' ').replace(/\s+/g, ' ').replace(/ ([,.;:)])/g, '$1').trim(); };
  const navLabel = (id) => { const a = document.querySelector(`#nav a[href="#${id}"]`); if (a) return (a.dataset.label || a.textContent).replace(/^[^\w(]+/, '').trim();
    const s = document.getElementById(id); const h = s && s.querySelector('h1'); return h ? h.textContent.trim() : id; };
  return [...document.querySelectorAll('main>section')].map((s) => ({ id: s.id, title: navLabel(s.id), h1: (s.querySelector('h1') || {}).textContent || '', text: secText(s) }));
});
await browser.close();
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/search-index.json', JSON.stringify(idx));
console.log(`search index: ${idx.length} pages, ${(JSON.stringify(idx).length / 1024).toFixed(0)} KB`);
