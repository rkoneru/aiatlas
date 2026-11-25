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

/* ---------- Phone layout (src/scripts/mobile.ts, src/lib/collapse-inline.ts) ---------- */
// Diagrams with hand-placed edge waypoints keep their drawn layout (and scroll inside their box).
const KEEP_LAYOUT = new Set(['spar', 'mcpseq']);

test('phone: diagrams are laid out top to bottom and fit the screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const problems: string[] = [];
  for (const id of ['overview', 'rag', 'agents', 'mcp', 'reference-arch', 'agentic-coding', 'cx-arch', 'fde-integration']) {
    await page.goto(url(id));
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => [...document.querySelectorAll('main [data-flow]')].filter((h) => (h as HTMLElement).offsetParent).map((h) => {
      const svg = h.querySelector('svg.fsvg:not(.seq)')!, box = h.querySelector('.flowbox')!;
      return { k: (h as HTMLElement).dataset.flow!, mob: svg.classList.contains('mob'), fits: svg.getBoundingClientRect().width <= box.clientWidth + 1 };
    }));
    for (const d of r) if (!KEEP_LAYOUT.has(d.k) && !(d.mob && d.fits)) problems.push(`${id}/${d.k}: ${JSON.stringify(d)}`);
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('phone: lists the runtime draws become tiles and follow its filters (glossary)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(url('glossary'));
  const tiles = page.locator('.mtile:visible');
  await expect.poll(() => tiles.count()).toBeGreaterThan(250);
  await expect(page.locator('#glList .card').first()).toBeHidden();
  await page.locator('#glQ').fill('rerank');
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toContainText('Reranking');
  await tiles.first().tap();
  await expect(page.locator('dialog.msheet .ms-body')).toContainText('cross-encoder');
  await page.keyboard.press('Escape');
  await page.locator('#glQ').fill('');
  await expect.poll(() => tiles.count()).toBeGreaterThan(250);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('phone: sections with tools stay open', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(url('cx-metrics'));
  await expect(page.locator('#cxmIn input').first()).toBeVisible();
  await page.goto(url('rag'));
  await expect(page.locator('#rk')).toBeVisible();
  await ctx.close();
});

test('desktop: nothing folds and diagrams keep their drawn layout', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url('agentic-coding'));
  await page.waitForTimeout(300);
  expect(await page.locator('main .mc-h, main .mc-b, main svg.mob').count()).toBe(0);
  await expect(page.locator('main table').first()).toBeVisible();
  await ctx.close();
});

test('phone screen layout (trial page): sections are tabs, a page fits in two screens, tiles open a sheet', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(url('agentic-coding'));
  await expect(page.locator('html')).toHaveClass(/m-screen/);
  // whole page within about two phone screens
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(844 * 2);
  // section tabs: one section shown at a time
  const tabs = page.locator('main > section > nav.mtabs[role=tablist] button[role=tab]');
  await expect(tabs).toHaveCount(5);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.mtile', { hasText: 'Completion' })).toBeVisible();
  await expect(page.locator('.mtile', { hasText: 'Spec-driven development' })).toBeHidden();
  await tabs.filter({ hasText: 'What makes coding agents work' }).tap();
  await expect(tabs.filter({ hasText: 'What makes coding agents work' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.mtile', { hasText: 'Completion' })).toBeHidden();
  // arrow keys move between tabs
  await tabs.filter({ hasText: 'What makes coding agents work' }).press('ArrowRight');
  await expect(tabs.filter({ hasText: 'Good and poor fits' })).toHaveAttribute('aria-selected', 'true');
  await tabs.filter({ hasText: 'Good and poor fits' }).press('ArrowLeft');
  // tiles open their content in the sheet, Previous / Next within the section
  const sheet = page.locator('dialog.msheet');
  await page.locator('.mtile', { hasText: 'Spec-driven development' }).tap();
  await expect(sheet.locator('#msheet-title')).toHaveText('Spec-driven development');
  await expect(sheet.locator('.ms-body')).toContainText('write the spec first');
  await sheet.locator('.ms-next').tap();
  await expect(sheet.locator('#msheet-title')).toHaveText("Tests are the agent's eyes");
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  // a table row in another tab
  await tabs.filter({ hasText: 'From autocomplete to autonomous' }).tap();
  await page.locator('.mtile', { hasText: 'Background agent' }).tap();
  await expect(sheet.locator('.ms-field small').nth(1)).toHaveText('Human role');
  await page.keyboard.press('Escape');
  // diagram: one row of controls; the rest behind ⋯
  const ctl = page.locator('main [data-flow] .fctl').first();
  await expect(ctl.locator('.reset')).toBeHidden();
  await ctl.locator('.fx-more').tap();
  await expect(ctl.locator('.reset')).toBeVisible();
  await expect(ctl.locator('.fx-more')).toHaveAttribute('aria-expanded', 'true');
  await ctl.locator('.next').tap();
  await expect(page.locator('main [data-flow] .cap').first()).toContainText('Step 1');
  // "Read more" on the summary
  await page.locator('.mmore').first().tap();
  await expect(sheet.locator('.ms-body')).toContainText('Walk one change from ticket to merge');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  await ctx.close();
});
