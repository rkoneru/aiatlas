/**
 * Phase 6: layouts at 375, 768 and 1280 px. Runs in every browser project
 * (Chromium locally; Chromium, Firefox and WebKit in CI).
 */
import { test, expect } from '@playwright/test';
import { PAGES, url, watchErrors } from './helpers';

for (const width of [375, 768, 1280]) {
  test(`no page scrolls sideways at ${width}px; wide tables scroll inside their card`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const problems: string[] = [];
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(url(p.id));
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const tables = [...document.querySelectorAll('main table')].filter((t) => (t as HTMLElement).offsetParent && t.scrollWidth > t.closest('section')!.clientWidth);
        const unscrollable = tables.filter((t) => { for (let x: Element | null = t; x && x.tagName !== 'SECTION'; x = x.parentElement) if (/auto|scroll/.test(getComputedStyle(x).overflowX)) return false; return true; }).length;
        return { overflow: document.documentElement.scrollWidth - vw, unscrollable };
      });
      if (r.overflow > 1) problems.push(`${p.id}: page is ${r.overflow}px wider than the viewport`);
      if (r.unscrollable) problems.push(`${p.id}: ${r.unscrollable} wide table(s) not in a scroll container`);
      await page.close();
    }
    expect(problems).toEqual([]);
    await ctx.close();
  });
}

test('375px: sidebar is a drawer behind the Menu button', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto('agents/');
  await expect(page.locator('#menubtn')).toBeVisible();
  await expect(page.locator('#nav')).toBeHidden();
  await page.locator('#menubtn').click();
  await expect(page.locator('#menubtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#nav')).toBeVisible();
  await page.locator('#nav summary').filter({ hasText: 'RAG' }).click();
  await page.locator('#nav a[data-href="#rag"]').click();
  await expect(page).toHaveURL(/\/rag\/$/);
  await expect(page.locator('#nav')).toBeHidden();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('375px: diagrams fit their box or scroll inside it, and step', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  for (const id of ['overview', 'agents', 'rag', 'mcp']) {
    await page.goto(url(id));
    await page.waitForTimeout(300);
    const r = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .flowbox`)].filter((b) => (b as HTMLElement).offsetParent).map((b) => {
      const box = b.getBoundingClientRect(); const cs = getComputedStyle(b);
      return { inside: box.right <= document.documentElement.clientWidth + 1, scrolls: b.scrollWidth <= b.clientWidth + 1 || /auto|scroll/.test(cs.overflowX) };
    }), id);
    for (const x of r) expect(x).toEqual({ inside: true, scrolls: true });
    const next = page.locator(`#${id} [data-flow] .fctl .next`).first();
    await next.tap();
    await expect(page.locator(`#${id} [data-flow] .cap .sn`).first()).toContainText('Step 1');
  }
  await ctx.close();
});
