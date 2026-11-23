#!/usr/bin/env node
/**
 * Share images (Open Graph / Twitter), 1200×630, one per page: nav-group label, page title,
 * site name, and the AI Atlas emblem. Rendered with satori (layout → SVG) and resvg (→ PNG)
 * using the self-hosted Inter font. Output: public/og/<page>.jpg (generated at build time).
 */
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const OUT = 'public/og';
const pages = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
const font = (w) => fs.readFileSync(`node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`);
const fonts = [400, 600, 800].map((w) => ({ name: 'Inter', data: font(w), weight: w, style: 'normal' }));
const dataUrl = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const EMBLEM = dataUrl('public/logo-mark.png');
const TILE = dataUrl('public/logo-tile.png');
const SITE_NAME = 'AI Architecture Atlas';

const h = (type, style, children) => ({ type, props: { style, children } });
const titleOf = (p) => (p.id === 'overview' ? p.title : p.navLabel || p.title);
const sizeFor = (t) => (t.length > 60 ? 50 : t.length > 40 ? 58 : 66);

function card(p) {
  const title = titleOf(p);
  const label = p.id === 'overview' ? 'Interactive guide to AI architecture' : p.group || 'AI Architecture Atlas';
  return h('div', { width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: 'Inter', color: '#eef3ff', background: 'linear-gradient(135deg, #061433 0%, #0b2a66 60%, #0e3a8a 100%)' }, [
    // emblem, right
    h('div', { position: 'absolute', left: 690, top: 13, width: 600, height: 600, display: 'flex', background: 'radial-gradient(circle, rgba(90,180,255,0.38) 0%, rgba(90,180,255,0.12) 42%, rgba(90,180,255,0) 68%)' }, []),
    { type: 'img', props: { src: EMBLEM, width: 420, height: 450, style: { position: 'absolute', right: 0, top: 88 } } },
    // text, left
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 0 56px 72px', width: 780, height: 630 }, [
      h('div', { display: 'flex' }, [
        h('div', { display: 'flex', fontSize: 24, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8fd3ff', border: '2px solid rgba(143,211,255,0.55)', borderRadius: 999, padding: '8px 20px' }, label),
      ]),
      h('div', { display: 'flex', fontSize: sizeFor(title), fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }, title),
      h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        { type: 'img', props: { src: TILE, width: 56, height: 56, style: { borderRadius: 12 } } },
        h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { display: 'flex', fontSize: 30, fontWeight: 800 }, SITE_NAME),
          h('div', { display: 'flex', fontSize: 22, fontWeight: 400, color: '#a9bce6' }, 'Interactive flows for AI systems, agents and protocols'),
        ]),
      ]),
    ]),
  ]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const p of pages) {
  const svg = await satori(card(p), { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const jpg = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${p.id}.jpg`), jpg);
  bytes += jpg.length;
}
console.log(`share images: ${pages.length} × 1200×630 in ${OUT}/ (${(bytes / 1048576).toFixed(1)} MB)`);
