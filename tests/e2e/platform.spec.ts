/**
 * Platform shim with PUBLIC_AI_ENABLED=false (the default build).
 */
import fs from 'node:fs';
import { test, expect, type Page, type Browser } from '@playwright/test';
import { PAGES, url, watchErrors } from './helpers';
// @ts-ignore
import { originalFile } from '../parity-lib.mjs';

const ORIG = originalFile();

test('capabilities resolve or reject as specified', async ({ page }) => {
  await page.goto('/rag/');
  const r = await page.evaluate(async () => {
    const use = (n: string) => (window as any).claude.use(n).then((x: any) => ({ ok: true, keys: Object.keys(x || {}).sort() }), (e: any) => ({ ok: false, code: e && e.code }));
    return { sample: await use('sample'), db: await use('db'), user: await use('user'), downloads: await use('downloads'), tts: await use('tts'), nope: await use('nope') };
  });
  expect(r.sample).toEqual({ ok: false, code: 'unavailable' });
  expect(r.db).toEqual({ ok: false, code: 'unavailable' });
  expect(r.user).toEqual({ ok: false, code: 'unavailable' });
  expect(r.downloads).toEqual({ ok: true, keys: ['save'] });
  expect(r.tts).toEqual({ ok: true, keys: ['onLine', 'onState', 'setRate', 'speak', 'stop'] });
  expect(r.nope.ok).toBe(false);
});

/**
 * With AI off, the set of visible buttons on every page must equal the original with no
 * Claude capabilities at all, apart from the controls that the shim legitimately turns on
 * (voice-over). So no AI button can appear.
 */
async function visibleButtons(page: Page, id: string) {
  return page.evaluate((id) => {
    const sec = document.querySelector(`main>section#${id}`)!;
    const vis = (e: Element) => !!(e as HTMLElement).offsetParent && !(e as HTMLElement).closest('[hidden]');
    return [...sec.querySelectorAll('button,a.b,[role=button]')].filter((e) => vis(e) && !e.closest('.vo')).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).sort();
  }, id);
}
async function origPage(browser: Browser, id: string) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(ORIG + '#' + id);
  return p;
}
for (const p of PAGES) {
  test(`no AI controls when AI is off: ${p.id}`, async ({ page, browser }) => {
    const o = await origPage(browser, p.id);
    await page.goto(url(p.id));
    await o.waitForTimeout(1200); await page.waitForTimeout(1200);
    expect(await visibleButtons(page, p.id)).toEqual(await visibleButtons(o, p.id));
    await o.context().close();
  });
}

test('downloads: diagram SVG and interactive HTML save as files; HTML has no Google Fonts', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/rag/');
  const flow = page.locator('#rag [data-flow]').first();
  await flow.locator('.exp').click();
  const [svg] = await Promise.all([page.waitForEvent('download'), flow.locator('[data-x="svg"]').click()]);
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  expect(fs.readFileSync((await svg.path())!, 'utf8')).toContain('<svg');
  const [html] = await Promise.all([page.waitForEvent('download'), flow.locator('[data-x="html"]').click()]);
  expect(html.suggestedFilename()).toMatch(/\.html$/);
  const body = fs.readFileSync((await html.path())!, 'utf8');
  expect(body).toContain('class Flow');
  expect(body).not.toContain('fonts.googleapis');
  // the exported file runs on its own: diagram renders and steps
  const viewer = await page.context().newPage();
  const vErrors = watchErrors(viewer);
  const exported = test.info().outputPath('exported-diagram.html');
  fs.writeFileSync(exported, body);
  await viewer.goto('file://' + exported);
  await expect(viewer.locator('#flow svg.fsvg').first()).toBeAttached();
  await viewer.locator('#flow .next').click();
  await expect(viewer.locator('#flow .cap .sn')).toContainText('Step 1');
  expect(vErrors).toEqual([]);
  await viewer.close();
  await expect(flow.locator('.expmsg')).toContainText('Saved');
  expect(errors).toEqual([]);
});

test('downloads: CAIO strategy exports save Markdown and HTML files', async ({ page }) => {
  await page.goto('/ai-strategy/');
  await page.locator('#scEx').click();
  const [md] = await Promise.all([page.waitForEvent('download'), page.locator('#scMd').click()]);
  expect(md.suggestedFilename()).toBe('ai-strategy.md');
  expect(fs.readFileSync((await md.path())!, 'utf8').length).toBeGreaterThan(200);
  const [html] = await Promise.all([page.waitForEvent('download'), page.locator('#scHtml').click()]);
  expect(html.suggestedFilename()).toBe('ai-strategy.html');
});

/** A fake speechSynthesis that "speaks" each utterance in 30 ms. */
const FAKE_TTS = `(() => {
  const spoken = window.__spoken = [];
  class U { constructor(t) { this.text = t; } }
  const q = [];
  let busy = false;
  const run = () => { if (busy || !q.length) return; busy = true; const u = q.shift(); spoken.push(u.text);
    setTimeout(() => { u.onstart && u.onstart({}); setTimeout(() => { busy = false; u.onend && u.onend({}); run(); }, 30); }, 0); };
  window.SpeechSynthesisUtterance = U;
  Object.defineProperty(window, 'speechSynthesis', { value: { speak(u) { q.push(u); run(); }, cancel() { q.length = 0; }, getVoices() { return [{ name: 'A', lang: 'en-US', localService: true }, { name: 'B', lang: 'en-GB', localService: true }]; } } });
})();`;

test('voice-over: narrates intro and steps, and advances the diagram as each line starts', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(FAKE_TTS);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto('/rag/');
  const flow = page.locator('#rag [data-flow]').first();
  const on = flow.locator('.vo-on');
  await expect(on).toBeVisible();
  await expect(on).toHaveAttribute('title', 'Narrate each step aloud');
  await on.click();
  await flow.locator('.play').click();
  await expect(flow.locator('.cap .sn')).toContainText('Step 9 / 9', { timeout: 15_000 });
  const spoken: string[] = await page.evaluate(() => (window as any).__spoken);
  expect(spoken.join(' ')).toContain('Ingest');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('voice-over is hidden where speechSynthesis does not exist', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { delete (window as any).speechSynthesis; delete (window as any).SpeechSynthesisUtterance; });
  const page = await ctx.newPage();
  await page.goto('/rag/');
  await page.waitForTimeout(500);
  await expect(page.locator('#rag [data-flow] .vo').first()).toBeHidden();
  await ctx.close();
});

test('AI-off wording is neutral (no claude.ai)', async ({ page }) => {
  for (const id of ['builder', 'llm-judge', 'team']) {
    await page.goto(url(id));
    await page.waitForTimeout(700);
    const txt = await page.locator(`main > section#${id}`).innerText();
    expect(txt, id).not.toMatch(/Open the Atlas on claude\.ai|open on claude\.ai|needs the Atlas open on claude\.ai/);
  }
  await page.goto('/builder/');
  await expect(page.locator('#pbOff')).toHaveText('AI drafting is turned off on this site.');
});
