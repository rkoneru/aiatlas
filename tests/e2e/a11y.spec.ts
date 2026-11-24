/**
 * Phase 5: WCAG 2.2 AA. axe-core on every page in light and dark mode (no serious or critical
 * violations), plus keyboard, diagram text alternatives, reduced motion and focus styles.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, url } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const scheme of ['light', 'dark'] as const) {
  for (const p of PAGES) {
    test(`axe ${scheme}: ${p.id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(url(p.id));
      await page.waitForTimeout(700);
      // Long lists use content-visibility: auto (site.css), so off-screen cards have no layout yet
      // and axe would read their targets as zero-sized. Render everything before measuring.
      await page.addStyleTag({ content: '*{content-visibility:visible!important}' });
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(bad).toEqual([]);
      await ctx.close();
    });
  }
}

test('404 page passes axe', async ({ page }) => {
  await page.goto('no-such-page/');
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('skip link is the first tab stop and moves focus to the content', async ({ page }) => {
  await page.goto('rag/');
  await page.waitForTimeout(400);
  await page.keyboard.press('Tab');
  const skip = page.locator('a.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
});

test('diagram boxes are reachable by keyboard and open with Enter', async ({ page }) => {
  await page.goto('rag/');
  await page.waitForTimeout(500);
  const node = page.locator('#rag [data-flow] g.node[role=button]').first();
  // reach it with the keyboard: focus the control before it, then Tab
  await node.evaluate((n) => { const all = [...document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]; all[all.indexOf(n as any) - 1].focus(); });
  await page.keyboard.press('Tab');
  await expect(node).toBeFocused();
  // visible focus ring on the box (the stroke animates, so poll)
  await expect.poll(() => node.evaluate((g) => parseFloat(getComputedStyle(g.querySelector('rect,circle')!).strokeWidth))).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Enter');
  await expect(page.locator('#rag [data-flow] .info').first()).toBeVisible();
});

test('every diagram has a text version with boxes, connections and steps', async ({ page }) => {
  await page.goto('rag/');
  await page.waitForTimeout(500);
  const flows = page.locator('#rag [data-flow]');
  const n = await flows.count();
  for (let i = 0; i < n; i++) {
    const tv = flows.nth(i).locator('xpath=following-sibling::*[1]');
    await expect(tv).toHaveClass(/flow-text/);
  }
  const tv = page.locator('#rag .flow-text').first();
  await tv.locator('summary').click();
  await expect(tv).toContainText('Boxes');
  await expect(tv).toContainText('Connections');
  await expect(tv).toContainText('Steps');
  await expect(tv).toContainText('→');
});

test('text version follows tab changes (diagram swapped by a tab)', async ({ page }) => {
  await page.goto('patterns/');
  await page.waitForTimeout(500);
  const host = page.locator('#patterns [data-flow="patterns"]');
  const tv = host.locator('xpath=following-sibling::*[1]');
  const before = await tv.textContent();
  await page.locator('#pattabs button').nth(1).click();
  await expect(tv).not.toHaveText(before || '');
});

test('reduced motion: no moving packets or animations', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('rag/');
  await page.waitForTimeout(400);
  await page.locator('#rag [data-flow] .fctl .next').first().click();
  const pkts = page.locator('#rag .pkt');
  if (await pkts.count()) await expect(pkts.first()).toBeHidden();
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect)?.getComputedTiming().duration as number > 1).length);
  expect(anims).toBe(0);
  await ctx.close();
});

test('focused buttons show a visible outline', async ({ page }) => {
  await page.goto('rag/');
  await page.waitForTimeout(400);
  const btn = page.locator('#rag .fctl .next').first();
  await btn.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const outline = await btn.evaluate((b) => getComputedStyle(b).outlineStyle + ' ' + getComputedStyle(b).outlineWidth);
  expect(outline).toMatch(/solid 3px/);
});
