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

test('phone app layout (trial page): icon tiles open their content in a bottom sheet', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(url('agentic-coding'));
  await expect(page.locator('html')).toHaveClass(/m-app/);
  expect(await page.locator('main h2.mc-h').count()).toBe(0); // no section folding on app pages
  // every card and table row is a tile; the original blocks are hidden on screen
  expect(await page.locator('.mtile').count()).toBeGreaterThanOrEqual(20);
  await expect(page.locator('main table').first()).toBeHidden();
  await expect(page.locator('.mtile').filter({ hasText: 'Spec-driven development' })).toBeVisible();
  // section tabs jump to their section
  const tabs = page.locator('nav.mtabs button');
  await expect(tabs.filter({ hasText: 'Risks & controls' })).toHaveCount(1);
  await tabs.filter({ hasText: 'Measuring it' }).tap();
  await expect.poll(() => page.locator('main h2', { hasText: 'Measuring it' }).evaluate((h) => Math.round(h.getBoundingClientRect().top))).toBeLessThan(260);
  // a card tile opens its full text; Previous / Next step through the section
  const sheet = page.locator('dialog.msheet');
  await page.locator('.mtile').filter({ hasText: 'Spec-driven development' }).tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('#msheet-title')).toHaveText('Spec-driven development');
  await expect(sheet.locator('.ms-body')).toContainText('write the spec first');
  await expect(sheet.locator('.ms-pos')).toHaveText('2 of 6');
  await sheet.locator('.ms-next').tap();
  await expect(sheet.locator('#msheet-title')).toHaveText("Tests are the agent's eyes");
  await sheet.locator('.ms-x').tap();
  await expect(sheet).toBeHidden();
  // a table-row tile shows every column with its name
  await page.locator('.mtile').filter({ hasText: 'Background agent' }).tap();
  await expect(sheet.locator('.ms-field small').nth(1)).toHaveText('Human role');
  await expect(sheet.locator('.ms-body')).toContainText('Reviews the pull request');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  // long text is clipped; "Read more" opens all of it
  await page.locator('.mmore').first().tap();
  await expect(sheet.locator('.ms-body')).toContainText('Walk one change from ticket to merge');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  await ctx.close();
});
