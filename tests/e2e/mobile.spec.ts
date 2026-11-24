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

test('phone: text-only sections fold under their heading; diagrams stay open', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(url('agent-evals'));
  const toggles = page.locator('main h2.mc-h .mc-t');
  expect(await toggles.count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('main [data-flow] svg.fsvg.mob')).toBeVisible();
  const table = page.locator('main table').first();
  await expect(table).toBeHidden();
  const first = toggles.first();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await first.tap();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
  await first.tap();
  await expect(table).toBeHidden();
  // Something pointing inside a folded section (a search highlight) opens it.
  const card = page.locator('main .mc-b.grid .card h3').first();
  await expect(card).toBeHidden();
  await card.evaluate((h) => { const m = document.createElement('mark'); m.textContent = 'x'; h.appendChild(m); });
  await expect(card).toBeVisible();
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

test('phone app layout (trial page): every title shows, tiles and table rows open on tap', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(url('agentic-coding'));
  await expect(page.locator('html')).toHaveClass(/m-app/);
  expect(await page.locator('main h2.mc-h').count()).toBe(0); // nothing folds at section level
  // tabs: one per section plus "Expand all"; tapping one scrolls to its section
  const tabs = page.locator('nav.mtabs button');
  await expect(tabs.last()).toHaveText('Expand all');
  await expect(tabs.filter({ hasText: 'Risks & controls' })).toHaveCount(1);
  await tabs.filter({ hasText: 'Measuring it' }).tap();
  await expect.poll(() => page.locator('main h2', { hasText: 'Measuring it' }).evaluate((h) => Math.round(h.getBoundingClientRect().top))).toBeLessThan(260);
  // tiles: title and a preview visible, body opens on tap anywhere on the tile
  const tile = page.locator('.card.tc').filter({ hasText: 'Spec-driven development' });
  await expect(tile.locator('h3')).toBeVisible();
  await expect(tile.locator('p').first()).toBeVisible();
  await expect(tile.locator('.tc-t')).toHaveAttribute('aria-expanded', 'false');
  await tile.locator('p').first().tap();
  await expect(tile.locator('.tc-t')).toHaveAttribute('aria-expanded', 'true');
  // table rows: a card per row, other columns open with their column name
  const row = page.locator('tr.tt-row').filter({ hasText: 'Background agent' });
  await expect(row.locator('td').nth(2)).toBeHidden();
  await row.locator('.tt-t').tap();
  await expect(row.locator('td').nth(2)).toBeVisible();
  await expect(row.locator('td').nth(2)).toHaveAttribute('data-label', 'Human role');
  // expand all
  await tabs.last().tap();
  expect(await page.locator('.tc-t[aria-expanded="false"], .tt-t[aria-expanded="false"]').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  await ctx.close();
});
