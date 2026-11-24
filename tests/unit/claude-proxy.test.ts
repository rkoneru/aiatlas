/**
 * Unit tests for the AI proxy (functions/_lib/claude-proxy.ts) with a fake Anthropic client and an
 * in-memory KV. Run: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { handle, LIMITS, type Env, type KV } from '../../functions/_lib/claude-proxy.ts';

const ORIGIN = 'https://atlas.example.com';
const memKV = (): KV & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, async get(k) { return data.get(k) ?? null; }, async put(k, v) { data.set(k, v); } }; };
const env = (over: Partial<Env> = {}): Env => ({ ANTHROPIC_API_KEY: 'sk-test', CLAUDE_MODEL_DEFAULT: 'model-default', CLAUDE_MODEL_QUICK: 'model-quick', SITE_ORIGIN: ORIGIN, RATE_KV: memKV(), ...over });
const req = (body: unknown, headers: Record<string, string> = {}) => new Request('https://atlas.example.com/api/claude', {
  method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const reply = (text: string, stop: string = 'end_turn') => ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'm', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text, citations: null }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } } as unknown as Anthropic.Beta.BetaMessage);

test('success: returns text, uses env model, caps max_tokens, low effort, fallbacks', async () => {
  let seen: any; const logs: any[] = [];
  const res = await handle(req({ prompt: 'secret question about RAG', tier: 'default' }), env(), { createMessage: async (p) => { seen = p; return reply('Answer.'); }, log: (e) => logs.push(e) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: 'Answer.', truncated: false });
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(seen.model, 'model-default');
  assert.equal(seen.max_tokens, LIMITS.maxTokens);
  assert.equal(seen.max_tokens, 1500);
  assert.deepEqual(seen.output_config, { effort: 'low' });
  assert.equal(seen.fallbacks, 'default');
  assert.deepEqual(seen.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(seen.thinking, undefined);
  // logs: counts only, never prompt or reply text
  assert.equal(JSON.stringify(logs).includes('secret question'), false);
  assert.equal(JSON.stringify(logs).includes('Answer.'), false);
  assert.equal(logs[0].chars, 'secret question about RAG'.length);
});

test('quick tier uses CLAUDE_MODEL_QUICK; no fallbacks for Haiku models; messages pass through', async () => {
  let seen: any;
  await handle(req({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }], tier: 'quick' }), env({ CLAUDE_MODEL_QUICK: 'claude-haiku-x' }), { createMessage: async (p) => { seen = p; return reply('ok'); }, log: () => {} });
  assert.equal(seen.model, 'claude-haiku-x');
  assert.equal(seen.fallbacks, undefined);
  assert.equal(seen.messages.length, 3);
});

test('json mode adds the JSON instruction; images become image blocks', async () => {
  let seen: any;
  await handle(req({ prompt: 'p', json: true, images: [{ media_type: 'image/png', data: 'iVBORw0KGgo=' }] }), env(), { createMessage: async (p) => { seen = p; return reply('{}'); }, log: () => {} });
  assert.match(seen.system, /only one valid JSON value/);
  assert.equal(seen.messages[0].content[0].type, 'image');
  assert.equal(seen.messages[0].content[1].text, 'p');
});

test('max_tokens stop reports truncated', async () => {
  const res = await handle(req({ prompt: 'p' }), env(), { createMessage: async () => reply('partial', 'max_tokens'), log: () => {} });
  assert.deepEqual(await res.json(), { text: 'partial', truncated: true });
});

test('refusal maps to refused; empty reply to empty_completion', async () => {
  let r = await handle(req({ prompt: 'p' }), env(), { createMessage: async () => reply('', 'refusal'), log: () => {} });
  assert.equal((await r.json()).error.code, 'refused');
  r = await handle(req({ prompt: 'p' }), env(), { createMessage: async () => reply('  '), log: () => {} });
  assert.equal((await r.json()).error.code, 'empty_completion');
});

test('origin check: other origins and missing origin are rejected; preflight', async () => {
  let r = await handle(req({ prompt: 'p' }, { origin: 'https://evil.example' }), env(), { log: () => {} });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  const noOrigin = new Request('https://x/api/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"prompt":"p"}' });
  r = await handle(noOrigin, env(), { log: () => {} });
  assert.equal(r.status, 403);
  r = await handle(new Request('https://x/api/claude', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env());
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('caps: prompt over 30,000 characters, too many messages, bad images', async () => {
  let r = await handle(req({ prompt: 'x'.repeat(LIMITS.maxPromptChars + 1) }), env(), { log: () => {} });
  assert.equal(r.status, 413); assert.equal((await r.json()).error.code, 'prompt_too_large');
  r = await handle(req({ messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'a' })) }), env(), { log: () => {} });
  assert.equal((await r.json()).error.code, 'prompt_too_large');
  r = await handle(req({ prompt: 'p', images: [{ media_type: 'image/tiff', data: 'AAAA' }] }), env(), { log: () => {} });
  assert.equal((await r.json()).error.code, 'image_rejected');
  r = await handle(req({ messages: [{ role: 'assistant', content: 'a' }] }), env(), { log: () => {} });
  assert.equal(r.status, 400);
});

test('per-IP hourly limit, per-IP daily limit and global daily cap return rate_limited', async () => {
  const ok = async () => reply('ok');
  let e = env({ RATE_LIMIT_PER_HOUR: '3' });
  for (let i = 0; i < 3; i++) assert.equal((await handle(req({ prompt: 'p' }), e, { createMessage: ok, log: () => {} })).status, 200);
  let r = await handle(req({ prompt: 'p' }), e, { createMessage: ok, log: () => {} });
  assert.equal(r.status, 429); assert.equal((await r.json()).error.code, 'rate_limited');
  // another IP is unaffected
  assert.equal((await handle(req({ prompt: 'p' }, { 'cf-connecting-ip': '198.51.100.1' }), e, { createMessage: ok, log: () => {} })).status, 200);

  e = env({ RATE_LIMIT_PER_HOUR: '100', RATE_LIMIT_PER_DAY: '2' });
  const t0 = new Date('2026-11-23T10:00:00Z'), t1 = new Date('2026-11-23T15:00:00Z');
  await handle(req({ prompt: 'p' }), e, { createMessage: ok, log: () => {}, now: () => t0 });
  await handle(req({ prompt: 'p' }), e, { createMessage: ok, log: () => {}, now: () => t0 });
  r = await handle(req({ prompt: 'p' }), e, { createMessage: ok, log: () => {}, now: () => t1 });
  assert.equal(r.status, 429);

  e = env({ DAILY_REQUEST_CAP: '2' });
  await handle(req({ prompt: 'p' }, { 'cf-connecting-ip': '1.1.1.1' }), e, { createMessage: ok, log: () => {} });
  await handle(req({ prompt: 'p' }, { 'cf-connecting-ip': '2.2.2.2' }), e, { createMessage: ok, log: () => {} });
  r = await handle(req({ prompt: 'p' }, { 'cf-connecting-ip': '3.3.3.3' }), e, { createMessage: ok, log: () => {} });
  assert.equal(r.status, 429);
  // IPs are hashed in KV keys
  assert.equal([...(e.RATE_KV as any).data.keys()].some((k: string) => k.includes('1.1.1.1')), false);
});

test('not configured → unavailable (no key, no model, no KV)', async () => {
  for (const over of [{ ANTHROPIC_API_KEY: '' }, { CLAUDE_MODEL_DEFAULT: '' }, { RATE_KV: undefined }]) {
    const r = await handle(req({ prompt: 'p' }), env(over), { createMessage: async () => reply('x'), log: () => {} });
    assert.equal(r.status, 503, JSON.stringify(over)); assert.equal((await r.json()).error.code, 'unavailable');
  }
});

test('upstream errors map to the codes the UI handles', async () => {
  const headers = new Headers();
  const cases: Array<[unknown, number, string]> = [
    [new Anthropic.RateLimitError(429, { type: 'error' }, 'rate', headers), 429, 'rate_limited'],
    [new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long: 1200000 tokens > 1000000 maximum' } }, undefined, headers), 400, 'prompt_too_large'],
    [new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'bad field' } }, undefined, headers), 400, 'invalid_request'],
    [new Anthropic.InternalServerError(500, { type: 'error' }, 'boom', headers), 502, 'upstream_error'],
    [new Anthropic.AuthenticationError(401, { type: 'error' }, 'auth', headers), 503, 'unavailable'],
  ];
  for (const [err, status, code] of cases) {
    const r = await handle(req({ prompt: 'p' }), env(), { createMessage: async () => { throw err; }, log: () => {} });
    assert.equal(r.status, status); assert.equal((await r.json()).error.code, code);
  }
});

test('Turnstile: required when TURNSTILE_SECRET is set', async () => {
  const e = env({ TURNSTILE_SECRET: 'ts' });
  let r = await handle(req({ prompt: 'p' }), e, { createMessage: async () => reply('x'), log: () => {} });
  assert.equal(r.status, 403);
  const fakeFetch = (async (_u: string, init: any) => new Response(JSON.stringify({ success: init.body.get('response') === 'good' }))) as unknown as typeof fetch;
  r = await handle(req({ prompt: 'p', turnstile: 'bad' }), e, { createMessage: async () => reply('x'), log: () => {}, fetch: fakeFetch });
  assert.equal(r.status, 403);
  r = await handle(req({ prompt: 'p', turnstile: 'good' }), e, { createMessage: async () => reply('x'), log: () => {}, fetch: fakeFetch });
  assert.equal(r.status, 200);
});

test('non-POST and non-JSON are rejected', async () => {
  let r = await handle(new Request('https://x/api/claude', { method: 'GET', headers: { origin: ORIGIN } }), env(), { log: () => {} });
  assert.equal(r.status, 405);
  r = await handle(req('not json'), env(), { log: () => {} });
  assert.equal(r.status, 400);
});

test('rate limiting ignores X-Forwarded-For unless TRUST_FORWARDED=on', async () => {
  const ok = async () => ({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) as any;
  // no CF-Connecting-IP: a client rotating X-Forwarded-For still lands in one bucket
  const noCf = (xff: string) => new Request('https://atlas.example.com/api/claude', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': xff }, body: JSON.stringify({ prompt: 'p' }) });
  let e = env({ RATE_LIMIT_PER_HOUR: '2' });
  for (const ip of ['10.0.0.1', '10.0.0.2']) assert.equal((await handle(noCf(ip), e, { createMessage: ok, log: () => {} })).status, 200);
  assert.equal((await handle(noCf('10.0.0.3'), e, { createMessage: ok, log: () => {} })).status, 429);
  // trusted behind a proxy that sets the header itself
  e = env({ RATE_LIMIT_PER_HOUR: '2', TRUST_FORWARDED: 'on' });
  for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) assert.equal((await handle(noCf(ip), e, { createMessage: ok, log: () => {} })).status, 200);
});
