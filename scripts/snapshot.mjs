#!/usr/bin/env node
/**
 * Build-time snapshot (decision Q1). Runs after `astro build`.
 *
 * Many Atlas pages draw most of their content with JavaScript (diagrams, tables, cards).
 * For each built page this script renders it in headless Chromium, takes the rendered
 * <main> section, and writes it into the HTML. The original section markup moves to
 * <template id="atlas-src">. The page runtime's first statement (scripts/build-runtime.ts)
 * puts the original back before anything else runs, so the runtime behaves exactly as
 * before, while browsers, crawlers and link previews get the full content at first paint
 * (no layout shift while diagrams are drawn).
 *
 * Usage: node scripts/snapshot.mjs [distDir] [basePath]   (defaults: $ATLAS_OUT_DIR|dist, $ATLAS_BASE|/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../tests/static-server.mjs';

const DIST = path.resolve(process.argv[2] || process.env.ATLAS_OUT_DIR || 'dist');
const BASE = ('/' + (process.argv[3] || process.env.ATLAS_BASE || '').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
const PORT = 4400 + Math.floor(Math.random() * 400);
const PAGES = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
const MERGED = JSON.parse(fs.readFileSync('src/data/redirects.json', 'utf8'));
const IDS = new Set(PAGES.map((p) => p.id));
const url = (id) => (id === 'overview' ? BASE : `${BASE}${id}/`);
const file = (id) => path.join(DIST, id === 'overview' ? '' : id, 'index.html');

/** Links the runtime draws as #page become real URLs in the snapshot (crawlable, and right before JS runs). */
const rewrite = (html) => html.replace(/href="#([^"]+)"/g, (m, id) => (IDS.has(id) ? `href="${url(id)}"` : MERGED[id] ? `href="${url(MERGED[id])}#${id}"` : m));

// Same seeded Math.random as the parity test, so two loads of a page can be compared.
const INIT = `(() => { let s = 1234567; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();`;
const finalState = async (ctx, id) => {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}${url(id)}`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const h = await page.evaluate((id) => document.querySelector(`main>section#${CSS.escape(id)}`).outerHTML.replace(/\bfl\d+/g, 'fl#'), id);
  await page.close();
  return h;
};

const srv = await serve(PORT, DIST, BASE);
const browser = await chromium.launch();
let done = 0, skipped = 0, kept = 0;
const fallbacks = [];
const queue = PAGES.slice();
async function worker() {
  for (let p; (p = queue.shift());) {
    const f = file(p.id);
    let html = fs.readFileSync(f, 'utf8');
    if (html.includes('id="atlas-src"')) { skipped++; continue; } // already snapshotted
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}${url(p.id)}`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const rendered = await page.evaluate((id) => {
      const s = document.querySelector(`main>section#${CSS.escape(id)}`);
      if (!s) return null;
      const c = s.cloneNode(true);
      c.querySelectorAll('mark.srch-flash').forEach((m) => m.replaceWith(...m.childNodes));
      return c.innerHTML;
    }, p.id);
    await page.close();
    if (rendered == null) throw new Error(`no section on ${p.id}`);
    const before = await finalState(ctx, p.id);
    // Replace the section's inner HTML; keep the original in a template right after it.
    const open = html.indexOf(`<section id="${p.id}"`);
    const start = html.indexOf('>', open) + 1;
    const end = html.indexOf('</section>', start);
    if (open < 0 || end < 0) throw new Error(`section markup not found in ${f}`);
    const original = html.slice(start, end);
    // containers with an id that are empty in the original but filled in the snapshot
    const empty = [...original.matchAll(/<(\w+)[^>]*\sid="([^"]+)"[^>]*><\/\1>/g)].map((m) => m[2]);
    const keepIds = empty.filter((id) => new RegExp(`id="${id}"[^>]*>(?!</)`).test(rendered));
    const write = (ids) => fs.writeFileSync(f, html.slice(0, start) + rewrite(rendered) + '</section>' +
      `<template id="atlas-src"${ids.length ? ` data-keep="${ids.join(' ')}"` : ''}>${original}</template>` + html.slice(end + '</section>'.length));
    write(keepIds);
    // The page must end in the same state as without the snapshot; otherwise drop data-keep.
    if (keepIds.length && (await finalState(ctx, p.id)) !== before) { write([]); fallbacks.push(p.id); }
    else kept += keepIds.length;
    if ((await finalState(ctx, p.id)) !== before) throw new Error(`snapshot changes the final state of ${p.id}`);
    await ctx.close();
    done++;
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
srv.close();
console.log(`snapshot: ${done} pages rendered into ${path.relative(process.cwd(), DIST)}/${skipped ? ` (${skipped} already done)` : ''}; ${kept} containers keep their snapshot until redrawn${fallbacks.length ? `; plain restore on ${fallbacks.join(', ')}` : ''}`);
