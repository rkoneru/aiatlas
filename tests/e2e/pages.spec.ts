import { test, expect } from '@playwright/test';
import { PAGES, url, watchErrors } from './helpers';

for (const p of PAGES) {
  test(`page ${p.id} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(url(p.id));
    await page.waitForTimeout(800);
    const sec = page.locator(`main > section#${p.id}`);
    await expect(sec).toBeVisible();
    await expect(page.locator('main > section')).toHaveCount(1);
    expect(await page.title()).toContain('AI Architecture Atlas');
    if (p.inNav) await expect(page.locator(`#nav a[data-href="#${p.id}"]`)).toHaveClass(/active/);
    // every visible diagram renders an SVG and steps forward
    const flows = sec.locator('[data-flow]');
    const n = await flows.count();
    for (let i = 0; i < n; i++) {
      const f = flows.nth(i);
      if (!(await f.isVisible())) continue;
      await expect(f.locator('svg.fsvg').first()).toBeAttached();
      const next = f.locator('.fctl .next');
      if ((await next.count()) && (await next.isVisible()) && (await f.locator('.chips .chip').count())) {
        await next.click();
        await expect(f.locator('.cap .sn')).toContainText('Step 1');
      }
    }
    expect(errors).toEqual([]);
  });
}
