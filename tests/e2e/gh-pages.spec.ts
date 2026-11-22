/**
 * The site built for a GitHub Pages project site (ATLAS_BASE=/aiatlas/, dist-gh/), served
 * under /aiatlas/ with no server redirects. Paths are relative to the project's baseURL.
 */
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers';

const B = '/aiatlas/';

test('home, nav links and assets resolve under the base path', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.locator('main > section#overview')).toBeVisible();
  await page.locator('#nav a[data-href="#rag"]').evaluate((a) => { (a.closest('details') as HTMLDetailsElement).open = true; });
  await page.locator('#nav a[data-href="#rag"]').click();
  await expect(page).toHaveURL(new RegExp(`${B}rag/$`));
  await expect(page.locator('main > section#rag svg.fsvg').first()).toBeAttached();
  const font = await page.evaluate(() => document.fonts.check('16px Inter'));
  expect(font).toBe(true);
  expect(errors).toEqual([]);
});

test('old #links and retired paths redirect within the base path', async ({ page }) => {
  await page.goto('./#rag');
  await expect(page).toHaveURL(new RegExp(`${B}rag/$`));
  await page.goto('mcp/#rag-math');
  await expect(page).toHaveURL(new RegExp(`${B}rag/#rag-math$`));
  await page.goto('rag-math/');
  await expect(page).toHaveURL(new RegExp(`${B}rag/#rag-math$`));
  await page.goto('overview/');
  await expect(page).toHaveURL(new RegExp(`${B}$`));
});

test('JS-built links, search index and handoffs work under the base path', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('paths/');
  await page.locator('.pa-go[data-k="learn"]').click();
  await expect(page).toHaveURL(new RegExp(`${B}ai-landscape/$`));
  await page.waitForLoadState('load');
  await page.keyboard.press('/');
  await expect(page.locator('.srch input[type=search]')).toBeVisible();
  await page.locator('.srch input[type=search]').fill('owasp');
  await page.locator('.srch-hit').filter({ hasText: 'AI security' }).first().click();
  await expect(page).toHaveURL(new RegExp(`${B}ai-security/$`));
  await expect(page.locator('mark.srch-flash')).toBeAttached();
  await page.locator('.ptools .pt-prac').click();
  await expect(page).toHaveURL(new RegExp(`${B}practice/$`));
  await expect(page.locator('#prPage')).toHaveValue('ai-security');
  await page.goto('./');
  await expect(page.locator('.atlas-resume a')).toHaveAttribute('href', `${B}practice/`);
  expect(errors).toEqual([]);
});
