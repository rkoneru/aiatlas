/**
 * Per-page metadata (Phase 4): title, description, canonical URL, share image, JSON-LD.
 * Everything is derived from the extracted content; nothing is written by hand.
 */
import fs from 'node:fs';
import review from '../data/review.json';
import { BASE, PAGES, pageUrl, type PageMeta } from './site';

export const SITE_NAME = 'AI Architecture Atlas';
export const AUTHOR = 'Rakesh';
/** Pages kept out of search engines and the sitemap (Team mode is off, decision 4). */
export const NOINDEX = new Set(['team']);

const SITE = (import.meta.env.SITE || 'https://example.com').replace(/\/+$/, '');
/** Absolute URL for a site path that already includes the base. */
export const absolute = (p: string) => SITE + (p.startsWith('/') ? p : '/' + p);

const REVIEW = review as Record<string, { date: string; items: string[] }>;
let SEARCH: Array<{ id: string; text: string }> | null = null;
const searchText = (id: string) => {
  SEARCH ||= JSON.parse(fs.readFileSync('public/search-index.json', 'utf8'));
  return SEARCH!.find((x) => x.id === id)?.text || '';
};

/** Trim to at most `max` characters at a word boundary, with an ellipsis when cut. */
export function trim(s: string, max = 155) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}

export function pageTitle(p: PageMeta) {
  return p.navLabel || p.title;
}

export function seo(p: PageMeta) {
  const name = pageTitle(p);
  const title = p.id === 'overview' ? `${SITE_NAME} · ${p.title}` : `${name} · ${SITE_NAME}`;
  // p.lead (trimmed); pages without one use the start of their rendered text.
  const description = trim(p.lead || searchText(p.id).replace(new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), ''));
  const url = absolute(pageUrl(p.id));
  const image = absolute(`${BASE}og/${p.id}.jpg`);
  const modified = REVIEW[p.id]?.date || null;
  const jsonLd: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': p.id === 'overview' ? 'WebPage' : 'Article',
      ...(p.id === 'overview' ? { name: title } : { headline: name }),
      description,
      url,
      image,
      inLanguage: 'en',
      ...(p.group ? { articleSection: p.group } : {}),
      ...(modified ? { dateModified: modified } : {}),
      author: { '@type': 'Person', name: AUTHOR },
      publisher: { '@type': 'Person', name: AUTHOR },
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absolute(BASE) },
    },
  ];
  if (p.id === 'overview') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: absolute(BASE),
      inLanguage: 'en',
      publisher: { '@type': 'Person', name: AUTHOR },
      // /?q=term opens the site search with that term (src/scripts/boot.ts)
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${absolute(BASE)}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    });
  }
  return { title, description, url, image, modified, noindex: NOINDEX.has(p.id), ogType: p.id === 'overview' ? 'website' : 'article', jsonLd, group: p.group || '' };
}

export const indexablePages = () => PAGES.filter((p) => !NOINDEX.has(p.id));
export const reviewDate = (id: string) => REVIEW[id]?.date || null;
