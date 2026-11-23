/**
 * Phase 4: per-page metadata, share images, JSON-LD, sitemap, robots, 404 and ?q= search.
 */
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { PAGES, url, watchErrors } from './helpers';

const SITE = 'https://example.com'; // PUBLIC_SITE_URL default for local builds
const pageUrl = (id: string) => (id === 'overview' ? '/' : `/${id}/`);
const decode = (s?: string) => s?.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const REVIEW: Record<string, { date: string }> = JSON.parse(fs.readFileSync('src/data/review.json', 'utf8'));

test('every page has its title, description, canonical, share tags and JSON-LD', async ({ request }) => {
  const problems: string[] = [];
  for (const p of PAGES) {
    const html = await (await request.get(url(p.id))).text();
    const head = html.slice(0, html.indexOf('</head>'));
    const attr = (re: RegExp) => (head.match(re) || [])[1];
    const name = p.navLabel || p.title;
    const title = decode(attr(/<title>([^<]*)<\/title>/));
    const want = p.id === 'overview' ? `AI Architecture Atlas · ${p.title}` : `${name} · AI Architecture Atlas`;
    if (title !== want) problems.push(`${p.id}: title "${title}" ≠ "${want}"`);
    const desc = decode(attr(/<meta name="description" content="([^"]*)"/));
    if (!desc || desc.length < 40 || desc.length > 155) problems.push(`${p.id}: description length ${desc?.length}`);
    if (attr(/<link rel="canonical" href="([^"]*)"/) !== SITE + pageUrl(p.id)) problems.push(`${p.id}: canonical`);
    if (attr(/<meta property="og:url" content="([^"]*)"/) !== SITE + pageUrl(p.id)) problems.push(`${p.id}: og:url`);
    const img = attr(/<meta property="og:image" content="([^"]*)"/);
    if (img !== `${SITE}/og/${p.id}.jpg`) problems.push(`${p.id}: og:image ${img}`);
    if (attr(/<meta name="twitter:card" content="([^"]*)"/) !== 'summary_large_image') problems.push(`${p.id}: twitter:card`);
    if (attr(/<meta name="twitter:image" content="([^"]*)"/) !== img) problems.push(`${p.id}: twitter:image`);
    const noindex = /<meta name="robots" content="noindex"/.test(head);
    if (noindex !== (p.id === 'team')) problems.push(`${p.id}: noindex=${noindex}`);
    const ld = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const main = ld[0];
    if (!main || main['@type'] !== (p.id === 'overview' ? 'WebPage' : 'Article')) problems.push(`${p.id}: JSON-LD type`);
    if (main?.url !== SITE + pageUrl(p.id)) problems.push(`${p.id}: JSON-LD url`);
    if ((main?.dateModified || null) !== (REVIEW[p.id]?.date || null)) problems.push(`${p.id}: dateModified ${main?.dateModified}`);
    if (p.id === 'overview') {
      const site = ld.find((x) => x['@type'] === 'WebSite');
      if (!site || site.potentialAction?.['@type'] !== 'SearchAction' || !site.potentialAction.target.urlTemplate.endsWith('/?q={search_term_string}')) problems.push('overview: WebSite SearchAction');
    }
  }
  expect(problems).toEqual([]);
});

test('share images exist for every page at 1200×630', async () => {
  for (const p of PAGES) {
    const m = await sharp(`dist/og/${p.id}.jpg`).metadata();
    expect([p.id, m.width, m.height, m.format]).toEqual([p.id, 1200, 630, 'jpeg']);
  }
});

test('sitemap lists every indexable page with review dates; robots points to it', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBe(PAGES.length - 1);
  expect(locs).not.toContain(`${SITE}/team/`);
  for (const p of PAGES.filter((x) => x.id !== 'team')) expect(locs).toContain(SITE + pageUrl(p.id));
  for (const [id, r] of Object.entries(REVIEW)) expect(xml).toContain(`<loc>${SITE}${pageUrl(id)}</loc><lastmod>${r.date}</lastmod>`);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test('?q= opens the site search with the term', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?q=owasp');
  await expect(page.locator('.srch')).toBeVisible();
  await expect(page.locator('.srch input[type=search]')).toHaveValue('owasp');
  await expect(page.locator('.srch-hit').filter({ hasText: 'AI security' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('404 page suggests a search and close pages', async ({ page }) => {
  const res = await page.goto('/retreival-augmented/');
  expect(res!.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page not found');
  await expect(page.locator('#nf-q')).toHaveValue('retreival augmented');
  await expect(page.locator('#nf-sugg')).toBeVisible();
  await page.locator('#nf-q').fill('guardrails');
  await page.locator('.nf-form button').click();
  await expect(page).toHaveURL(/\/\?q=guardrails$/);
  await expect(page.locator('.srch-hit').first()).toBeVisible();
});

test('404 page sends a retired id straight to its page', async ({ page }) => {
  await page.goto('/rag-math'); // no trailing slash → not the redirect stub
  await expect(page).toHaveURL(/\/rag\/#rag-math$/);
});
