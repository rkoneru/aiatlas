/** Phase 7: footer, privacy, terms, contact. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, url, watchErrors } from './helpers';

test('every page has the footer: owner, licences, views line, About/Privacy/Terms/Contact', async ({ request }) => {
  for (const p of PAGES) {
    const html = await (await request.get(url(p.id))).text();
    const f = html.slice(html.indexOf('<footer class="site-footer"'), html.indexOf('</footer>') + 9);
    expect(f, p.id).toContain('Rakesh');
    expect(f, p.id).toContain('CC BY-NC 4.0');
    expect(f, p.id).toContain('MIT');
    expect(f, p.id).toContain('Views are my own');
    for (const l of ['/about/', '/privacy/', '/terms/', 'mailto:']) expect(f, `${p.id} ${l}`).toContain(l);
  }
});

for (const id of ['privacy', 'terms']) {
  test(`${id} page: draft, noindex, no errors, passes axe`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${id}/`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.draft-note')).toHaveText('Draft, under review');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('privacy page covers analytics, local storage, hosting and AI', async ({ page }) => {
  await page.goto('privacy/');
  const t = await page.locator('main').innerText();
  for (const s of ['Plausible', 'localStorage', 'atlas-', 'Hosting', 'Anthropic', 'no cookies']) expect(t.toLowerCase()).toContain(s.toLowerCase());
});

test('terms page: educational, no warranty, not legal/compliance/financial advice, licences', async ({ page }) => {
  await page.goto('terms/');
  const t = await page.locator('main').innerText();
  for (const s of ['educational', 'no warranty', 'not legal', 'financial', 'CC BY-NC 4.0', 'MIT']) expect(t.toLowerCase()).toContain(s.toLowerCase());
});

test('About links to contact; vendor-neutrality text unchanged', async ({ page }) => {
  await page.goto('about/');
  await expect(page.locator('#about a#contact')).toHaveAttribute('href', /^mailto:/);
  await expect(page.locator('#about')).toContainText('The patterns are vendor-neutral: RAG, agents, MCP, A2A, evaluation and governance work the same on any model or platform. Product names appear as examples, not endorsements.');
});

test('draft pages stay out of the sitemap', async ({ request }) => {
  const xml = await (await request.get('sitemap.xml')).text();
  expect(xml).not.toContain('/privacy/');
  expect(xml).not.toContain('/terms/');
});
