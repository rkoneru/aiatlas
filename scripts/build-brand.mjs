#!/usr/bin/env node
/**
 * Brand assets for AI Atlas, derived from the supplied artwork
 * (assets/brand/ai-atlas-brand-source.jpg: logo lockup + favicon tile on paper).
 *
 * Outputs (public/):
 *   favicon.ico (16/32/48), favicon-32.png, favicon-128.png, apple-touch-icon.png (180),
 *   icon-192.png, icon-512.png, icon-maskable-512.png, site.webmanifest  ← from the favicon tile
 *   logo.png / logo-dark.png (emblem + "AI ATLAS / NAVIGATING INTELLIGENCE", transparent),
 *   logo-mark.png (emblem only, transparent), logo-tile.png (68 px sidebar tile)                              ← from the lockup
 * and docs/brand-preview.png.
 *
 * The paper background is removed with a colour-to-alpha pass against the paper colour,
 * so the glow and anti-aliased edges keep their partial transparency. The dark variant
 * recolours the navy wordmark to the site's dark-theme ink.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'assets/brand/ai-atlas-brand-source.jpg';
const OUT = 'public';
// Regions in the 2816×1536 source (measured from the artwork).
const R = {
  lockup: { left: 790, top: 262, width: 1400, height: 516 },   // emblem + wordmark
  emblem: { left: 790, top: 262, width: 482, height: 516 },
  wordmarkX: 1294 - 790,                                         // wordmark starts here inside the lockup
  tile: { left: 199, top: 1015, width: 375, height: 375 },       // favicon tile
};
// The emblem's disc (solid artwork: never made transparent, so its white highlights stay).
const DISC = { cx: 1020.5, cy: 549.5, r: 217 };
const TILE_RADIUS = 0.215; // corner radius as a share of the tile size (≈80 px of 375)
const PAPER = [240, 240, 240];
const DARK_INK = [236, 238, 254]; // --ink in the site's dark theme

const img = sharp(SRC);
const meta = await img.metadata();
if (meta.width !== 2816 || meta.height !== 1536) throw new Error(`unexpected source size ${meta.width}×${meta.height}`);

/** Colour-to-alpha against the paper colour; returns raw RGBA. */
async function unpaper(region, { recolorFromX = null, recolor = null } = {}) {
  const { data, info } = await sharp(SRC).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const c = [data[p], data[p + 1], data[p + 2]];
    // Paper is neutral and ~240: opacity comes from darkness below the paper and from colour
    // (the emblem's glow is blue, the paper grey). Neutral pixels near paper level are background.
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const dark = Math.max(0, (PAPER[0] - 8 - lum) / (PAPER[0] - 8));
    const chroma = (Math.max(...c) - Math.min(...c)) / 255;
    let a = Math.max(dark * 1.15, Math.max(0, chroma - 0.035) * 2.2);
    a = Math.min(1, a);
    if (a < 0.04) a = 0;
    { const px = region.left + (q / 4) % info.width, py = region.top + Math.floor(q / 4 / info.width);
      const d = Math.hypot(px - DISC.cx, py - DISC.cy);
      if (d <= DISC.r - 2) a = 1; else if (d <= DISC.r) a = Math.max(a, (DISC.r - d) / 2); }
    const x = (q / 4) % info.width;
    for (let i = 0; i < 3; i++) {
      let v = a > 0 ? (c[i] - PAPER[i] * (1 - a)) / a : 0;
      if (recolor && x >= recolorFromX) v = recolor[i];
      out[q + i] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[q + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** The favicon tile with its rounded corners made transparent. */
async function tile(size, { bleed = false, inset = 1 } = {}) {
  const t = R.tile.width;
  const r = Math.round(t * TILE_RADIUS);
  const crop = sharp(await sharp(SRC).extract(R.tile).png().toBuffer()); // materialise: composite runs before extract in one pipeline
  if (bleed) {
    // full-bleed square (iOS and Android round it themselves): tile art on its own navy
    const { data } = await sharp(SRC).extract({ left: R.tile.left + 30, top: R.tile.top + t - 40, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const navy = { r: data[0], g: data[1], b: data[2] };
    const inner = Math.round(t * inset);
    const mask = Buffer.from(`<svg width="${inner}" height="${inner}"><rect width="${inner}" height="${inner}" rx="${Math.round(r * inset)}"/></svg>`);
    // sharp runs resize before composite inside one pipeline, so materialise each step
    const resized = await crop.resize(inner, inner).png().toBuffer();
    const art = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const full = await sharp({ create: { width: t, height: t, channels: 4, background: { ...navy, alpha: 1 } } })
      .composite([{ input: art, left: Math.round((t - inner) / 2), top: Math.round((t - inner) / 2) }]).png().toBuffer();
    return sharp(full).resize(size, size, { kernel: 'lanczos3' }).png();
  }
  const mask = Buffer.from(`<svg width="${t}" height="${t}"><rect x="1.5" y="1.5" width="${t - 3}" height="${t - 3}" rx="${r}"/></svg>`);
  return sharp(await crop.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()).resize(size, size, { kernel: 'lanczos3' }).png();
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of ['favicon.svg', 'logo.svg', 'logo-mark.svg']) fs.rmSync(path.join(OUT, f), { force: true }); // previous generated mark
fs.rmSync('src/generated/brand-glyph.svg', { force: true });

await (await tile(32)).toFile(path.join(OUT, 'favicon-32.png'));
await (await tile(128)).toFile(path.join(OUT, 'favicon-128.png'));
await (await tile(68)).toFile(path.join(OUT, 'logo-tile.png')); // sidebar, 34 px at 2×
await (await tile(180, { bleed: true })).toFile(path.join(OUT, 'apple-touch-icon.png'));
await (await tile(192)).toFile(path.join(OUT, 'icon-192.png'));
await (await tile(512)).toFile(path.join(OUT, 'icon-512.png'));
await (await tile(512, { bleed: true, inset: 0.82 })).toFile(path.join(OUT, 'icon-maskable-512.png'));

const PNG = { compressionLevel: 9, effort: 10 };
const save = async (s, file, width) => sharp(await s.png().toBuffer()).resize({ width }).png(PNG).toFile(path.join(OUT, file));
await save(await unpaper(R.lockup), 'logo.png', 1000);
await save(await unpaper(R.lockup, { recolorFromX: R.wordmarkX, recolor: DARK_INK }), 'logo-dark.png', 1000);
await save(await unpaper(R.emblem), 'logo-mark.png', 400);

/* favicon.ico with PNG-compressed 16/32/48 entries */
const entries = [];
for (const s of [16, 32, 48]) entries.push([s, await (await tile(s)).toBuffer()]);
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
let off = 6 + 16 * entries.length; const dir = [];
for (const [s, b] of entries) { const e = Buffer.alloc(16); e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(b.length, 8); e.writeUInt32LE(off, 12); off += b.length; dir.push(e); }
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...dir, ...entries.map((e) => e[1])]));

fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({
  name: 'AI Architecture Atlas', short_name: 'AI Atlas', start_url: './', scope: './', display: 'standalone',
  background_color: '#f6f6fa', theme_color: '#0b1f4d',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

/* preview sheet: logo on light and dark, icons at real sizes */
const W = 1600, H = 760;
const light = await sharp(path.join(OUT, 'logo.png')).resize({ height: 230 }).toBuffer();
const dark = await sharp(path.join(OUT, 'logo-dark.png')).resize({ height: 230 }).toBuffer();
const icons = [[128, 'favicon-128.png'], [64, 'favicon-128.png'], [32, 'favicon-32.png'], [16, 'favicon-32.png']];
const comps = [
  { input: { create: { width: W / 2, height: H, channels: 4, background: '#0f1020' } }, left: W / 2, top: 0 },
  { input: light, left: 40, top: 60 },
  { input: dark, left: W / 2 + 40, top: 60 },
];
let x = 60;
for (const [s, f] of icons) {
  const b = await sharp(path.join(OUT, f)).resize(s, s).toBuffer();
  comps.push({ input: b, left: x, top: 420 + (128 - s) }); comps.push({ input: b, left: W / 2 + x - 20, top: 420 + (128 - s) });
  x += s + 50;
}
const apple = await sharp(path.join(OUT, 'apple-touch-icon.png')).resize(128, 128).toBuffer();
comps.push({ input: apple, left: x + 40, top: 420 });
await sharp({ create: { width: W, height: H, channels: 4, background: '#f6f6fa' } }).composite(comps).png().toFile('docs/brand-preview.png');
console.log('brand assets written to public/ from', SRC);
