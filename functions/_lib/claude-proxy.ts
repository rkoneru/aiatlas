/**
 * AI proxy for the Atlas (Phase 8). Platform-neutral core: takes a Request and an env, returns a
 * Response. Wrapped by functions/api/claude.ts (Cloudflare Pages Function); a Vercel wrapper is
 * in docs/ai-proxy.md.
 *
 * Request (POST, JSON; contract in docs/platform.md):
 *   { prompt?: string, messages?: [{role, content}], json?: boolean, tier?: 'default'|'quick',
 *     images?: [{media_type, data}], turnstile?: string }
 * Response: { text, truncated } or { error: { code, message } } with an HTTP status.
 *
 * Protection: origin check (CORS), size caps, per-IP hourly/daily limits and a global daily cap in
 * KV, optional Turnstile. Logs carry counts and error codes only, never prompt or reply text.
 */
import Anthropic from '@anthropic-ai/sdk';

/** The subset of Workers KV the proxy uses. */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  ANTHROPIC_API_KEY?: string;
  /** Model IDs from Anthropic's docs, e.g. claude-opus-5-5 / claude-haiku-5-5. Required: no defaults in code. */
  CLAUDE_MODEL_DEFAULT?: string;
  CLAUDE_MODEL_QUICK?: string;
  /** low | medium | high (thinking counts toward the 1,500-token output cap, so low is the default) */
  CLAUDE_EFFORT?: string;
  /** "off" disables server-side refusal fallbacks (default on for models that support them) */
  CLAUDE_FALLBACKS?: string;
  /** Allowed browser origin(s), comma-separated, e.g. https://atlas.example.com */
  SITE_ORIGIN?: string;
  RATE_LIMIT_PER_HOUR?: string;
  RATE_LIMIT_PER_DAY?: string;
  DAILY_REQUEST_CAP?: string;
  /** Salt for hashing client IPs before they become KV keys. */
  IP_HASH_SALT?: string;
  /** Set to require a Cloudflare Turnstile token in the request body. */
  TURNSTILE_SECRET?: string;
  RATE_KV?: KV;
}

export const LIMITS = { maxTokens: 1500, maxPromptChars: 30_000, maxMessages: 40, maxImages: 2, maxImageBase64: 5_000_000 };
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const JSON_INSTRUCTION = 'Reply with only one valid JSON value, with no prose before or after it and no code fences.';
const SYSTEM = 'You are the assistant of the AI Architecture Atlas, an educational site about AI architecture. Answer accurately and concisely, from the material provided when there is some. If you are not sure, say so.';

type Deps = {
  /** Injected for tests; defaults to the Anthropic SDK client. */
  createMessage?: (params: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage>;
  log?: (entry: Record<string, unknown>) => void;
  fetch?: typeof fetch;
  now?: () => Date;
};

class ProxyError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message || code); }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.SITE_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' };
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fixed-window counters in KV. KV is eventually consistent, so limits are approximate. */
async function checkLimits(env: Env, ip: string, now: Date) {
  const kv = env.RATE_KV;
  if (!kv) throw new ProxyError(503, 'unavailable', 'rate limiter not configured');
  const hour = now.toISOString().slice(0, 13), day = now.toISOString().slice(0, 10);
  const id = await sha256((env.IP_HASH_SALT || '') + ip);
  const perHour = +(env.RATE_LIMIT_PER_HOUR || 20), perDay = +(env.RATE_LIMIT_PER_DAY || 100), cap = +(env.DAILY_REQUEST_CAP || 500);
  const keys = { h: `ip:${id}:${hour}`, d: `ip:${id}:${day}`, g: `global:${day}` };
  const [h, d, g] = await Promise.all([kv.get(keys.h), kv.get(keys.d), kv.get(keys.g)]).then((v) => v.map((x) => +(x || 0)));
  if (g >= cap) throw new ProxyError(429, 'rate_limited', 'daily capacity reached');
  if (h >= perHour || d >= perDay) throw new ProxyError(429, 'rate_limited', 'too many requests from this address');
  await Promise.all([
    kv.put(keys.h, String(h + 1), { expirationTtl: 3600 + 60 }),
    kv.put(keys.d, String(d + 1), { expirationTtl: 86400 + 60 }),
    kv.put(keys.g, String(g + 1), { expirationTtl: 86400 + 60 }),
  ]);
}

async function verifyTurnstile(env: Env, token: unknown, ip: string, doFetch: typeof fetch) {
  if (!env.TURNSTILE_SECRET) return;
  if (typeof token !== 'string' || !token) throw new ProxyError(403, 'not_granted', 'missing verification');
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET); form.append('response', token); form.append('remoteip', ip);
  const r = await doFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  if (!j.success) throw new ProxyError(403, 'not_granted', 'verification failed');
}

type Body = { prompt?: unknown; messages?: unknown; json?: unknown; tier?: unknown; images?: unknown; turnstile?: unknown };

/** Validate the browser's request and turn it into Messages API input. */
export function buildMessages(body: Body): { messages: Anthropic.Beta.BetaMessageParam[]; chars: number; images: number } {
  let msgs: Array<{ role: 'user' | 'assistant'; content: string }>;
  if (Array.isArray(body.messages)) {
    if (body.messages.length === 0 || body.messages.length > LIMITS.maxMessages) throw new ProxyError(400, 'prompt_too_large', 'too many messages');
    msgs = body.messages.map((m: any) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') throw new ProxyError(400, 'invalid_request', 'bad message');
      return { role: m.role, content: m.content };
    });
    if (msgs[0].role !== 'user') throw new ProxyError(400, 'invalid_request', 'first message must be from the user');
  } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
    msgs = [{ role: 'user', content: body.prompt }];
  } else throw new ProxyError(400, 'invalid_request', 'prompt or messages required');
  const chars = msgs.reduce((a, m) => a + m.content.length, 0);
  if (chars > LIMITS.maxPromptChars) throw new ProxyError(413, 'prompt_too_large', `prompt over ${LIMITS.maxPromptChars} characters`);

  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length > LIMITS.maxImages) throw new ProxyError(400, 'image_rejected', 'too many images');
  const imageBlocks: Anthropic.Beta.BetaImageBlockParam[] = images.map((im: any) => {
    if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== 'string' || im.data.length > LIMITS.maxImageBase64 || !/^[A-Za-z0-9+/=]+$/.test(im.data)) throw new ProxyError(400, 'image_rejected', 'unsupported image');
    return { type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } };
  });

  const out: Anthropic.Beta.BetaMessageParam[] = msgs.map((m) => ({ role: m.role, content: m.content }));
  if (imageBlocks.length) {
    const last = [...out].reverse().find((m) => m.role === 'user')!;
    last.content = [...imageBlocks, { type: 'text', text: last.content as string }];
  }
  return { messages: out, chars, images: imageBlocks.length };
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const log = deps.log || ((e) => console.log(JSON.stringify(e)));
  const now = (deps.now || (() => new Date()))();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, env);
  const started = Date.now();
  const entry: Record<string, unknown> = { at: now.toISOString(), path: 'api/claude' };
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: origin && cors['access-control-allow-origin'] ? 204 : 403, headers: cors });
    if (request.method !== 'POST') throw new ProxyError(405, 'invalid_request', 'POST only');
    // Browsers send Origin on POST; only the site may call the proxy.
    if (!origin || !cors['access-control-allow-origin']) throw new ProxyError(403, 'not_granted', 'origin not allowed');
    if (!(request.headers.get('content-type') || '').includes('application/json')) throw new ProxyError(415, 'invalid_request', 'JSON only');
    const raw = await request.text();
    if (raw.length > LIMITS.maxPromptChars * 2 + LIMITS.maxImages * LIMITS.maxImageBase64 + 10_000) throw new ProxyError(413, 'prompt_too_large', 'request too large');
    let body: Body;
    try { body = JSON.parse(raw); } catch { throw new ProxyError(400, 'invalid_request', 'invalid JSON body'); }

    const tier = body.tier === 'quick' ? 'quick' : 'default';
    const model = tier === 'quick' ? env.CLAUDE_MODEL_QUICK || env.CLAUDE_MODEL_DEFAULT : env.CLAUDE_MODEL_DEFAULT;
    if (!env.ANTHROPIC_API_KEY || !model) throw new ProxyError(503, 'unavailable', 'proxy not configured');
    const { messages, chars, images } = buildMessages(body);
    Object.assign(entry, { tier, model, chars, images, msgs: messages.length, json: !!body.json });

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    await verifyTurnstile(env, body.turnstile, ip, deps.fetch || fetch);
    await checkLimits(env, ip, now);

    const effort = (['low', 'medium', 'high'].includes(env.CLAUDE_EFFORT || '') ? env.CLAUDE_EFFORT : 'low') as 'low' | 'medium' | 'high';
    // Server-side refusal fallbacks: on by default for models that support them (not Haiku).
    const fallbacks = env.CLAUDE_FALLBACKS !== 'off' && !/haiku/i.test(model);
    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: LIMITS.maxTokens,
      system: body.json ? `${SYSTEM}\n\n${JSON_INSTRUCTION}` : SYSTEM,
      messages,
      output_config: { effort },
      ...(fallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    };
    const create = deps.createMessage || ((p) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 55_000 }).beta.messages.create(p));
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await create(params);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ProxyError(429, 'rate_limited', 'upstream rate limit');
      if (e instanceof Anthropic.BadRequestError) throw new ProxyError(400, /too long|too many tokens/i.test(`${e.message} ${JSON.stringify(e.error ?? '')}`) ? 'prompt_too_large' : 'invalid_request', 'rejected upstream');
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ProxyError(503, 'unavailable', 'upstream credentials');
      if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIError) throw new ProxyError(502, 'upstream_error', 'upstream error');
      throw e;
    }
    entry.stop = res.stop_reason;
    entry.in = res.usage?.input_tokens; entry.out = res.usage?.output_tokens;
    if (res.stop_reason === 'refusal') throw new ProxyError(200, 'refused', 'declined');
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    if (!text.trim()) throw new ProxyError(200, 'empty_completion', 'no text');
    entry.status = 200; entry.ms = Date.now() - started;
    log(entry);
    return json(200, { text, truncated: res.stop_reason === 'max_tokens' }, cors);
  } catch (e) {
    const err = e instanceof ProxyError ? e : new ProxyError(500, 'unavailable', 'internal error');
    Object.assign(entry, { status: err.status, error: err.code, ms: Date.now() - started });
    log(entry);
    return json(err.status, { error: { code: err.code, message: err.message } }, cors);
  }
}
