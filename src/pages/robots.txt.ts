import type { APIRoute } from 'astro';
import { BASE } from '../lib/site';
import { absolute } from '../lib/seo';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absolute(`${BASE}sitemap.xml`)}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
