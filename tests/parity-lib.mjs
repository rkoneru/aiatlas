// Shared helpers for comparing a page in the original single file with the built site.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function originalFile() {
  const html = fs.readFileSync('source/atlas.html', 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-orig-')), 'atlas.html');
  fs.writeFileSync(f, html);
  return 'file://' + f;
}

// Deterministic Math.random and a fixed clock so both sides draw the same "random" content.
export const INIT = `(() => { let s = 1234567; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();`;

/** Section HTML with differences that are expected between the two builds normalized away. */
export async function snapshot(page, id) {
  return page.evaluate((id) => {
    const sec = document.querySelector(`main>section#${CSS.escape(id)}`);
    if (!sec) return null;
    const c = sec.cloneNode(true);
    c.removeAttribute('hidden');
    c.querySelectorAll('[href]').forEach((a) => {
      let h = a.getAttribute('href');
      const m = h.match(/^\/([\w-]*)\/?(#.*)?$/);
      if (m && !h.startsWith('//')) h = m[2] || '#' + (m[1] || 'overview');
      a.setAttribute('href', h);
    });
    return c.outerHTML
      .replace(/\bfl\d+([ab]|sa|sb)?\b/g, 'fl#$1')
      .replace(/url\(#fl#/g, 'url(#fl#');
  }, id);
}

export function firstDiff(a, b) {
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return { at: i, original: a.slice(Math.max(0, i - 120), i + 200), built: b.slice(Math.max(0, i - 120), i + 200) };
}
