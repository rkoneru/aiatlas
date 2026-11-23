import type { APIRoute } from 'astro';
import { pageUrl } from '../lib/site';
import { BASE, SITE_CONFIG } from '../lib/site';
import { absolute, indexablePages, reviewDate } from '../lib/seo';

// Every page except noindex ones (Team mode). lastmod comes from the Atlas's own review dates.
export const GET: APIRoute = () => {
  const urls = indexablePages().map((p) => {
    const lm = reviewDate(p.id);
    return `  <url><loc>${absolute(pageUrl(p.id))}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`;
  });
  // site pages (Phase 7) once they are no longer drafts
  for (const id of ['privacy', 'terms']) if (!SITE_CONFIG.draftPages.includes(id)) urls.push(`  <url><loc>${absolute(`${BASE}${id}/`)}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
