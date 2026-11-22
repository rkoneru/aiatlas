#!/usr/bin/env node
/**
 * Generates the AI Architecture Atlas logo and favicons from one definition.
 *
 * Mark: a node-graph "A" (apex and two feet joined like a diagram, with a crossbar
 * between two smaller nodes) inside a faint orbit ring, on a purple → blue tile.
 * The apex node is orange: the one "active" node, like a highlighted step in the
 * Atlas's diagrams. Colors are the site's --purple, --blue and --orange.
 *
 * Outputs (public/): favicon.svg, favicon.ico (16+32+48), apple-touch-icon.png,
 * icon-192.png, icon-512.png, icon-maskable-512.png, logo-mark.svg, logo.svg,
 * logo.png, logo-dark.png, site.webmanifest; and src/generated/brand-glyph.svg for
 * the sidebar. PNGs are rendered in headless Chromium with the self-hosted Inter font.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = 'public';
const C = { purple: '#6b46f5', blue: '#2563eb', orange: '#ff8a3d', ink: '#15162b', inkDark: '#eceefe' };

const gradient = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>`;

/** The white glyph on a 64×64 grid. `small` = heavier and simpler, for 16–32 px. */
function glyph(small = false) {
  const top = [32, small ? 14 : 13], l = [small ? 15 : 16, small ? 50 : 49], r = [small ? 49 : 48, small ? 50 : 49];
  const at = (y) => { const t = (y - top[1]) / (l[1] - top[1]); return [top[0] + (l[0] - top[0]) * t, top[0] + (r[0] - top[0]) * t]; };
  const cy = small ? 38 : 37, [cxl, cxr] = at(cy);
  const sw = small ? 6 : 4.5;
  return [
    small ? '' : `<circle cx="32" cy="34" r="23" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>`,
    `<path d="M${top} L${l} M${top} L${r} M${cxl.toFixed(1)} ${cy} H${cxr.toFixed(1)}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${top[0]}" cy="${top[1]}" r="${small ? 7 : 6}" fill="${C.orange}" stroke="#fff" stroke-width="${small ? 2.5 : 2.2}"/>`,
    `<circle cx="${l[0]}" cy="${l[1]}" r="${small ? 5.5 : 4.5}" fill="#fff"/>`,
    `<circle cx="${r[0]}" cy="${r[1]}" r="${small ? 5.5 : 4.5}" fill="#fff"/>`,
    small ? '' : `<circle cx="${cxl.toFixed(1)}" cy="${cy}" r="3.2" fill="#fff"/><circle cx="${cxr.toFixed(1)}" cy="${cy}" r="3.2" fill="#fff"/>`,
  ].join('');
}

/** Tile + glyph. `bleed` = square full-bleed (apple-touch, maskable); `inset` scales the glyph into a safe zone. */
function mark({ small = false, bleed = false, inset = 1 } = {}) {
  const g = inset === 1 ? glyph(small) : `<g transform="translate(${32 - 32 * inset} ${32 - 32 * inset}) scale(${inset})">${glyph(small)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${gradient('atlasg')}</defs><rect width="64" height="64" rx="${bleed ? 0 : 15}" fill="url(#atlasg)"/>${g}</svg>`;
}

/** Horizontal lockup: mark + "AI Architecture Atlas". */
function lockup(dark = false) {
  const ink = dark ? C.inkDark : C.ink;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 96" role="img" aria-label="AI Architecture Atlas">
<defs>${gradient('atlasl')}<linearGradient id="atlasw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark ? '#9b82ff' : C.purple}"/><stop offset="1" stop-color="${dark ? '#60a0ff' : C.blue}"/></linearGradient></defs>
<g transform="translate(8 8) scale(1.25)"><rect width="64" height="64" rx="15" fill="url(#atlasl)"/>${glyph(false)}</g>
<text x="108" y="45" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="30" font-weight="800" fill="${ink}" letter-spacing="-.4">AI Architecture</text>
<text x="108" y="80" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="30" font-weight="800" fill="url(#atlasw)" letter-spacing="-.4">Atlas</text>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('src/generated', { recursive: true });
// favicon.svg: detailed mark, but switch to the simple glyph at tab sizes is not possible in one SVG,
// so the favicon uses the small (heavier) glyph, which also reads well large.
fs.writeFileSync(path.join(OUT, 'favicon.svg'), mark({ small: true }));
fs.writeFileSync(path.join(OUT, 'logo-mark.svg'), mark());
fs.writeFileSync(path.join(OUT, 'logo.svg'), lockup(false));
fs.writeFileSync('src/generated/brand-glyph.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${glyph(false)}</svg>`);

/* ---- PNG rendering ---- */
const font = (w) => `@font-face{font-family:Inter;font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(`node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff2`).toString('base64')}) format('woff2')}`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, w, h, file, bg = 'transparent') {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><style>${font(800)}html,body{margin:0;background:${bg}}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ omitBackground: bg === 'transparent', type: 'png' });
  if (file) fs.writeFileSync(path.join(OUT, file), buf);
  return buf;
}
await png(mark({ bleed: true }), 180, 180, 'apple-touch-icon.png');
await png(mark(), 192, 192, 'icon-192.png');
await png(mark(), 512, 512, 'icon-512.png');
await png(mark({ bleed: true, inset: 0.8 }), 512, 512, 'icon-maskable-512.png');
await png(lockup(false), 1040, 192, 'logo.png');
await png(lockup(true), 1040, 192, 'logo-dark.png', '#0f1020');
const ico = [];
for (const s of [16, 32, 48]) ico.push([s, await png(mark({ small: s <= 32 }), s, s, null)]);
await browser.close();

/* ---- favicon.ico (PNG-compressed entries) ---- */
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ico.length, 4);
let offset = 6 + 16 * ico.length;
const dir = [], data = [];
for (const [s, buf] of ico) {
  const e = Buffer.alloc(16);
  e.writeUInt8(s === 256 ? 0 : s, 0); e.writeUInt8(s === 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  offset += buf.length; dir.push(e); data.push(buf);
}
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([header, ...dir, ...data]));

fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({
  name: 'AI Architecture Atlas', short_name: 'AI Atlas', start_url: './', scope: './', display: 'standalone',
  background_color: '#f6f6fa', theme_color: C.purple,
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));
console.log('brand assets written to public/ and src/generated/brand-glyph.svg');
