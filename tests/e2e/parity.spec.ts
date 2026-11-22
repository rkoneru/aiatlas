/**
 * Differential test: each page is rendered in the original single file (source/atlas.html,
 * routed by #hash, with the same platform shim and declared wording changes) and on the
 * built site, with the same seeded Math.random. The page's
 * section HTML must match after load, after stepping every diagram, and after changing
 * each input, select and checkbox on the page (up to MAX_CONTROLS per page).
 */
import { test, expect, type Page } from '@playwright/test';
import { PAGES, url } from './helpers';
// @ts-ignore plain JS helper shared with scripts
import { originalFile, INIT, snapshot, firstDiff, platformScript } from '../parity-lib.mjs';

const ORIG = originalFile();
const SETTLE = 1800;
const MAX_CONTROLS = 30;
const CONTROLS = 'input[type=range],input[type=number],select,input[type=checkbox],input[type=radio]';

async function controls(page: Page, id: string) {
  return page.evaluate(([id, sel]) => {
    const sec = document.querySelector(`main>section#${id}`)!;
    return [...sec.querySelectorAll(sel)].map((el, i) => ({ i, vis: !!(el as HTMLElement).offsetParent, ui: !!el.closest('.ptools,.fctl,.vo,.expmenu,.src-box') }));
  }, [id, CONTROLS] as const);
}
async function act(page: Page, id: string, i: number) {
  await page.evaluate(([id, sel, i]) => {
    const el = document.querySelector(`main>section#${id}`)!.querySelectorAll(sel)[i as number] as any;
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') { el.click(); return; }
    if (el.tagName === 'SELECT') { if (el.options.length > 1) el.selectedIndex = el.options.length - 1; }
    else if (el.type === 'range') { const mn = +el.min || 0, mx = el.max === '' ? 100 : +el.max, st = +el.step || 1; el.value = String(Math.round((mn + (mx - mn) * 0.7) / st) * st); }
    else { const v = +el.value || 0; el.value = String(v ? v * 2 : 7); }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, CONTROLS, i] as const);
  await page.waitForTimeout(400);
}
async function stepFlows(page: Page, id: string) {
  await page.evaluate((id) => {
    document.querySelectorAll(`main>section#${id} [data-flow]`).forEach((f) => {
      const n = f.querySelector('.fctl .next') as HTMLButtonElement | null;
      if (n && (f as HTMLElement).offsetParent) { n.click(); n.click(); }
    });
  }, id);
  await page.waitForTimeout(300);
}

for (const p of PAGES) {
  test(`parity ${p.id}`, async ({ browser }) => {
    const ctxO = await browser.newContext(); await ctxO.addInitScript(INIT); await ctxO.addInitScript(platformScript());
    const ctxB = await browser.newContext(); await ctxB.addInitScript(INIT);
    const po = await ctxO.newPage(), pb = await ctxB.newPage();
    await po.goto(ORIG + '#' + p.id); await pb.goto(url(p.id));
    await po.waitForTimeout(SETTLE); await pb.waitForTimeout(SETTLE);
    let changed = 0;
    const check = async (label: string) => {
      const a = await snapshot(po, p.id), b = await snapshot(pb, p.id);
      if (a !== b) { const d = firstDiff(a || '', b || ''); expect.soft(b, `${label}\noriginal: …${d.original}\nbuilt:    …${d.built}`).toBe(a); return null; }
      return b as string;
    };
    let prev = await check('after load');
    await stepFlows(po, p.id); await stepFlows(pb, p.id);
    let cur = await check('after stepping diagrams');
    const cs = (await controls(pb, p.id)).filter((c) => c.vis && !c.ui).slice(0, MAX_CONTROLS);
    for (const c of cs) {
      if (cur === null) break;
      prev = cur;
      await act(po, p.id, c.i); await act(pb, p.id, c.i);
      cur = await check(`after changing control #${c.i}`);
      if (cur !== null && cur !== prev) changed++;
    }
    test.info().annotations.push({ type: 'controls', description: `${cs.length} exercised, ${changed} changed the page` });
    await ctxO.close(); await ctxB.close();
  });
}
