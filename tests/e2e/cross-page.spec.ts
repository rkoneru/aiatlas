/**
 * Features that span pages: old #links, search, course, practice, paths, handoffs,
 * the resume link, the infographic studio and the CAIO tools. Where useful, the same
 * action runs in the original single file and the results are compared.
 */
import { test, expect, type Page } from '@playwright/test';
import { watchErrors } from './helpers';
// @ts-ignore
import { originalFile } from '../parity-lib.mjs';

const ORIG = originalFile();
const settle = (p: Page, ms = 700) => p.waitForTimeout(ms);

test.describe('old links', () => {
  test('#page on any URL goes to that page', async ({ page }) => {
    await page.goto('/#rag');
    await expect(page).toHaveURL(/\/rag\/$/);
    await page.goto('/mcp/#a2a');
    await expect(page).toHaveURL(/\/a2a\/$/);
  });
  test('#merged-id goes to the page that now holds it and scrolls to the block', async ({ page }) => {
    await page.goto('/mcp/#rag-math');
    await expect(page).toHaveURL(/\/rag\/#rag-math$/);
    await settle(page, 500);
    await expect(page.locator('#rag-math')).toBeInViewport();
    await page.goto('/#agent-roi');
    await expect(page).toHaveURL(/\/usecase-roi\/#agent-roi$/);
  });
  test('/old-id/ path redirects (_redirects)', async ({ page }) => {
    await page.goto('/rag-math/');
    await expect(page).toHaveURL(/\/rag\/#rag-math$/);
    await page.goto('/overview/');
    await expect(page).toHaveURL(/\/$/);
  });
  test('#own-page hash is dropped', async ({ page }) => {
    await page.goto('/rag/#rag');
    await settle(page, 300);
    expect(new URL(page.url()).hash).toBe('');
  });
});

test('JS-built #links navigate to real pages (paths "Start")', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/paths/');
  await page.locator('.pa-go[data-k="learn"]').click();
  await expect(page).toHaveURL(/\/ai-landscape\/$/);
  await expect(page.locator('.pa-top')).toContainText('Learner path');
  await page.locator('.pa-top .pa-nx').click();
  await expect(page).toHaveURL(/\/ml-basics\/$/);
  await expect(page.locator('.pa-top')).toContainText('2 of');
  await page.goto('/paths/');
  await expect(page.locator('.pa-door').filter({ hasText: 'Learner' })).toContainText('2/11 done');
  expect(errors).toEqual([]);
});

test('search covers every page and highlights on the target page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/rag/');
  await settle(page);
  await page.keyboard.press('/');
  const input = page.locator('.srch input[type=search]');
  await expect(input).toBeFocused();
  await expect(page.locator('.srch-empty')).toContainText('across all 98 pages');
  await input.fill('owasp');
  const hit = page.locator('.srch-hit').filter({ hasText: 'AI security' }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(/\/ai-security\/$/);
  await expect(page.locator('mark.srch-flash')).toBeAttached();
  expect(errors).toEqual([]);
});

test('course: opening a lesson goes to its page with the course bar', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/course/');
  await page.locator('#cskip').click();
  await page.locator('[data-go="0,1"]').click();
  await expect(page).not.toHaveURL(/\/course\/$/);
  await expect(page.locator('#coursebar')).toBeVisible();
  await expect(page.locator('#coursebar')).toContainText(/Lesson|lesson|Module|module/);
  expect(errors).toEqual([]);
});

test('"Practice this page" opens practice filtered to the page', async ({ page }) => {
  await page.goto('/rag/');
  await settle(page);
  await page.locator('.ptools .pt-prac').click();
  await expect(page).toHaveURL(/\/practice\/$/);
  await expect(page.locator('#prPage')).toHaveValue('rag');
});

test('glossary links to pages and glossary tooltips appear on content pages', async ({ page }) => {
  await page.goto('/glossary/');
  await settle(page);
  expect(await page.locator('#glossary a[href^="#"]').count()).toBeGreaterThan(50);
  await page.goto('/rag/');
  await settle(page);
  expect(await page.locator('#rag .gl').count()).toBeGreaterThan(0);
});

test('home shows "continue where you left off" instead of redirecting', async ({ page }) => {
  await page.goto('/mcp/');
  await settle(page, 300);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.atlas-resume a')).toHaveAttribute('href', '/mcp/');
});

test('infographic button works on a content page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/rag/');
  await settle(page);
  await page.locator('.ig-pbtn').first().click();
  await expect(page.locator('.igm')).toBeVisible();
  await expect(page.locator('.igm .igm-c svg').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('industry → "Model the ROI" carries the preset to the ROI page, as in the original', async ({ page, browser }) => {
  const read = (p: Page) => p.evaluate(() => [...document.querySelectorAll('#arIn input')].map((i) => (i as HTMLInputElement).value));
  const o = await (await browser.newContext()).newPage();
  await o.goto(ORIG + '#industry'); await settle(o);
  await o.locator('#industry [data-k="healthcare"]').click(); await o.locator('#indRoi').click(); await settle(o);
  const want = await read(o);
  await page.goto('/industry/'); await settle(page);
  await page.locator('#industry [data-k="healthcare"]').click(); await page.locator('#indRoi').click();
  await expect(page).toHaveURL(/\/usecase-roi\/#agent-roi$/);
  await settle(page);
  expect(await read(page)).toEqual(want);
});

test('decision wizard → "Open in playground" loads the diagram on /playground/', async ({ page }) => {
  await page.goto('/decide/');
  await settle(page);
  // answer every question with its first option
  for (let i = 0; i < 12; i++) {
    const q = page.locator('#dwQ .sq-q').nth(i);
    if (!(await q.count())) break;
    await q.locator('.chip').first().click();
    await page.waitForTimeout(80);
  }
  const btn = page.locator('#dwPg');
  test.skip(!(await btn.count()), 'wizard did not reach a result with these answers');
  await btn.click();
  await expect(page).toHaveURL(/\/playground\/$/);
  await settle(page, 900);
  await expect(page.locator('#playground')).toContainText('Recommended architecture');
});

test('CAIO tools read each other across pages (strategy imports the portfolio)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/ai-strategy/');
  await settle(page);
  await page.locator('#scTop').click();
  await expect(page.locator('#scMsg')).not.toContainText('empty');
  expect(errors).toEqual([]);
});

test('nav matches the original, minus Team mode (decision 4)', async ({ page, browser }) => {
  const navText = (p: Page) => p.evaluate(() => [...document.querySelectorAll('#nav a')].map((a) => `${(a as HTMLElement).dataset.href || a.getAttribute('href')}|${a.textContent!.trim()}|${a.getAttribute('title')}`));
  const o = await (await browser.newContext()).newPage();
  await o.goto(ORIG + '#rag'); await settle(o);
  await page.goto('/rag/'); await settle(page);
  const want = (await navText(o)).filter((x) => !x.startsWith('#team|'));
  expect(await navText(page)).toEqual(want);
  const counts = (p: Page) => p.evaluate(() => [...document.querySelectorAll('#nav .cnt')].map((c) => c.textContent));
  const oc = await counts(o), bc = await counts(page);
  expect(bc.filter((_, i) => i !== 12)).toEqual(oc.filter((_, i) => i !== 12)); // group 12 is "Learn & practice"
  expect(+bc[12]!).toBe(+oc[12]! - 1);
  await page.goto('/team/');
  await expect(page.locator('main > section#team')).toBeVisible();
});
