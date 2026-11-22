/**
 * PUBLIC_AI_ENABLED=true build (dist-ai/) against a mocked /api/claude.
 * Run by the "ai" Playwright project; build it with `npm run build:ai-test`.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { watchErrors } from './helpers';

const INFOGRAPHIC = {
  kicker: 'Mock kicker', title: 'Mocked infographic title', subtitle: 'One sentence.',
  steps: ['Ingest', 'Index', 'Retrieve', 'Answer'],
  sections: [1, 2, 3, 4, 5, 6].map((i) => ({ icon: '🧩', heading: `Heading ${i}`, bullets: ['First bullet', 'Second bullet'] })),
  compare: { left: 'Before', right: 'After', rows: [['slow', 'fast'], ['manual', 'automatic']] },
  stats: [{ value: '42%', label: 'mock stat' }], tagline: 'Mock tagline',
};

type Seen = { body: any }[];
async function mock(page: Page, handler?: (body: any, route: Route) => Promise<boolean | void>) {
  const seen: Seen = [];
  await page.route('**/api/claude', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    seen.push({ body });
    if (handler && (await handler(body, route))) return;
    await new Promise((r) => setTimeout(r, 150));
    await route.fulfill({ json: body.json ? { text: '```json\n' + JSON.stringify(INFOGRAPHIC) + '\n```' } : { text: 'Mock answer about **RAG**.' } });
  });
  return seen;
}

test('Ask the Atlas sends the conversation and shows the answer', async ({ page }) => {
  const errors = watchErrors(page);
  const seen = await mock(page);
  await page.goto('/rag/');
  await page.locator('.pt-ask').click();
  const panel = page.locator('.ask-panel');
  await panel.locator('textarea').fill('What is reranking?');
  await panel.locator('.ask-send').click();
  await expect(panel.locator('.ask-log')).toContainText('Mock answer about RAG');
  expect(seen.length).toBe(1);
  expect(Array.isArray(seen[0].body.messages)).toBe(true);
  expect(seen[0].body.messages.at(-1)).toMatchObject({ role: 'user', content: 'What is reranking?' });
  expect(seen[0].body).toMatchObject({ json: false, tier: 'default' });
  await expect(panel.locator('.ask-foot')).toContainText('through this site');
  expect(errors).toEqual([]);
});

test('infographic studio: "Generate with Claude" fills the infographic', async ({ page }) => {
  const errors = watchErrors(page);
  const seen = await mock(page);
  await page.goto('/playground/');
  await expect(page.locator('#igAiBox')).toBeVisible();
  await page.locator('#igTopic').fill('Retrieval-augmented generation');
  await page.locator('#igGen').click();
  await expect(page.locator('#igMsg')).toContainText('Draft ready');
  await expect(page.locator('#igCanvas')).toContainText('Mocked infographic title');
  expect(seen[0].body.json).toBe(true);
  expect(errors).toEqual([]);
});

test('page infographic: "Improve with Claude" rewrites it from the page', async ({ page }) => {
  const errors = watchErrors(page);
  const seen = await mock(page);
  await page.goto('/rag/');
  await page.waitForTimeout(500);
  await page.locator('.ig-pbtn').first().click();
  const ai = page.locator('.igm .igm-ai');
  await expect(ai).toBeVisible();
  await ai.click();
  await expect(page.locator('.igm .igm-msg')).toContainText('Rewritten by Claude');
  await expect(page.locator('.igm .igm-c')).toContainText('Mocked infographic title');
  expect(seen[0].body.prompt).toContain('PAGE TEXT');
  expect(errors).toEqual([]);
});

test('errors map to the codes the UI handles: rate_limited', async ({ page }) => {
  await mock(page, async (_b, route) => { await route.fulfill({ status: 429, json: { error: { code: 'rate_limited' } } }); return true; });
  await page.goto('/playground/');
  await page.locator('#igTopic').fill('x');
  await page.locator('#igGen').click();
  await expect(page.locator('#igMsg')).toContainText('Too many requests');
});

test('errors map to the codes the UI handles: invalid_json', async ({ page }) => {
  await mock(page, async (_b, route) => { await route.fulfill({ json: { text: 'Sorry, here is prose, not JSON.' } }); return true; });
  await page.goto('/playground/');
  await page.locator('#igTopic').fill('x');
  await page.locator('#igGen').click();
  await expect(page.locator('#igMsg')).toContainText("wasn't usable");
});

test('errors map to the codes the UI handles: cancelled', async ({ page }) => {
  await mock(page, async (_b, route) => { await new Promise((r) => setTimeout(r, 4000)); await route.fulfill({ json: { text: '{}' } }).catch(() => {}); return true; });
  await page.goto('/playground/');
  await page.locator('#igTopic').fill('x');
  await page.locator('#igGen').click();
  await expect(page.locator('#igStop')).toBeVisible();
  await page.locator('#igStop').click();
  await expect(page.locator('#igMsg')).toHaveText('Stopped.');
});

test('errors map to the codes the UI handles: unavailable (server down)', async ({ page }) => {
  await mock(page, async (_b, route) => { await route.fulfill({ status: 503, body: 'down' }); return true; });
  await page.goto('/playground/');
  await page.locator('#igTopic').fill('x');
  await page.locator('#igGen').click();
  await expect(page.locator('#igMsg')).toContainText('unavailable');
});

test('Team mode stays off with AI on', async ({ page }) => {
  await page.goto('/team/');
  await expect(page.locator('#tmStatus')).toContainText("isn't available on this site");
});
