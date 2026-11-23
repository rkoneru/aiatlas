import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';
import pagesData from '../data/pages.json';
import merged from '../data/redirects.json';
import companions from '../data/companions.json';
import siteConfig from '../data/site.json';

/** Contact address: PUBLIC_CONTACT_EMAIL, else src/data/site.json (placeholder CONTACT_EMAIL until set). */
export const CONTACT_EMAIL: string = import.meta.env.PUBLIC_CONTACT_EMAIL || siteConfig.contactEmail;
export const SITE_CONFIG = siteConfig;

export type PageMeta = (typeof pagesData)[number];
export const PAGES: PageMeta[] = pagesData;
export const MERGED: Record<string, string> = merged;
const IDS = new Set(PAGES.map((p) => p.id));

/** Site base path with leading and trailing slash: '/' or '/aiatlas/'. */
export const BASE = ('/' + (import.meta.env.BASE_URL || '/').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
export const pageUrl = (id: string) => (id === 'overview' ? BASE : `${BASE}${id}/`);

const CONTENT_DIR = path.resolve('src/content/pages');
const cache = new Map<string, string>();
export function rawContent(id: string): string {
  if (!cache.has(id)) cache.set(id, fs.readFileSync(path.join(CONTENT_DIR, `${id}.html`), 'utf8'));
  return cache.get(id)!;
}

/** href="#page" -> /page/, href="#merged-id" -> /page/#merged-id. Other attributes are untouched. */
export function rewriteLinks(html: string): string {
  return html.replace(/href="#([^"]+)"/g, (m, id: string) => {
    if (IDS.has(id)) return `href="${pageUrl(id)}"`;
    if (MERGED[id]) return `href="${pageUrl(MERGED[id])}#${id}"`;
    return m;
  });
}

export function pageContent(id: string): string {
  return rewriteLinks(rawContent(id)).replaceAll('mailto:CONTACT_EMAIL', `mailto:${CONTACT_EMAIL}`);
}

/** Hidden, inert fragments a page's runtime needs from other pages (src/data/companions.json). */
export function companionHTML(id: string): string {
  const groups = companions.groups as Record<string, string[]>;
  const wanted = new Set<string>();
  for (const ref of (companions.pages as Record<string, string[]>)[id] || []) {
    (ref.startsWith('@') ? groups[ref.slice(1)] : [ref]).forEach((p) => p !== id && wanted.add(p));
  }
  let out = '';
  for (const p of wanted) {
    const meta = PAGES.find((x) => x.id === p)!;
    out += `<section id="${p}" style="--accent:var(--${meta.accent})">${pageContent(p)}</section>`;
  }
  for (const c of companions.all as Array<{ page: string; select: string }>) {
    if (c.page === id || wanted.has(c.page)) continue;
    const src = pageContent(c.page);
    const el = parse(src).querySelector(c.select);
    if (!el) throw new Error(`companion ${c.page} ${c.select} not found`);
    out += `<div data-companion="${c.page}">${src.slice(el.range[0], el.range[1])}</div>`;
  }
  return out;
}
