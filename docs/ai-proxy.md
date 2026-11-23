# AI proxy (Phase 8): built, off by default

The Atlas's AI features (Ask the Atlas, "Describe it" and "Improve with Claude", infographic generation, eval-case generation, the incident grader, the FDE assistant, the proposal summary) call `POST /api/claude`.

- **Where the code lives:** the proxy is `functions/api/claude.ts`, a Cloudflare Pages Function. Its logic is in `functions/_lib/claude-proxy.ts`.
- **How it's switched on:** it only receives traffic when the site is built with `PUBLIC_AI_ENABLED=true`. Otherwise the browser shim never calls it, and every AI button stays hidden.
- **GitHub Pages can't run it.** Turning AI on requires Cloudflare Pages (or Vercel or Netlify, below).

## What it does

| | |
|---|---|
| Input | `{prompt \| messages, json, tier, images?, turnstile?}` (the browser contract in `docs/platform.md`) |
| Model | `CLAUDE_MODEL_DEFAULT` for `tier: "default"`, `CLAUDE_MODEL_QUICK` for `tier: "quick"`. Both are read from the environment, with no IDs hard-coded. Current IDs (Anthropic model list, November 2026): `claude-opus-5-5` and `claude-haiku-5-5`. Check https://platform.claude.com/docs/en/about-claude/models before deploying. |
| Caps | `max_tokens` 1,500. Prompt text up to 30,000 characters. Up to 40 messages, 2 images (PNG/JPEG/WebP/GIF, about 3.75 MB each). |
| Thinking and effort | Thinking is always on with Opus 5.5, and it counts toward `max_tokens`. `output_config.effort` defaults to `low` (`CLAUDE_EFFORT`) so the 1,500-token cap leaves room for the answer. |
| JSON | `json: true` adds "reply with only one valid JSON value" to the system prompt. The browser parses the reply and tolerates code fences. |
| Refusals | Server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) are on for models that support them, and skipped for Haiku. Turn off with `CLAUDE_FALLBACKS=off`. If the whole chain declines, the result is `{error: {code: "refused"}}`. |
| Output | `{text, truncated}`, where `truncated` is true when the reply hit `max_tokens`. |
| Errors | `{error: {code, message}}` with these codes: `rate_limited` (429), `prompt_too_large` (413/400), `invalid_request`, `image_rejected`, `refused`, `empty_completion`, `not_granted` (origin or Turnstile), `unavailable` (not configured, 503), `upstream_error` (502). These are the codes the UI already handles. |

## Protection

- **Origin check (CORS):** only origins listed in `SITE_ORIGIN` (comma-separated) may call it. Requests without an `Origin`, or from any other origin, get a 403.
- **Per-IP limits:** 20 per hour and 100 per day by default (`RATE_LIMIT_PER_HOUR`, `RATE_LIMIT_PER_DAY`). They're kept in the KV namespace `RATE_KV`. IPs are hashed (SHA-256 with `IP_HASH_SALT`) before they become keys, and counters expire after an hour or a day. KV is eventually consistent, so the limits are approximate.
- **Global daily cap:** `DAILY_REQUEST_CAP` (default 500) is a spend guard. Once it's reached, every request gets `rate_limited` until midnight UTC.
- **Turnstile (optional):** set `TURNSTILE_SECRET` on the proxy and the build variable `PUBLIC_TURNSTILE_SITE_KEY` (the public site key from the same Turnstile widget). The proxy then requires a valid token in `body.turnstile`, and the platform shim gets a fresh one for every AI request:
  - Cloudflare's script loads only on the first AI request, so readers who never use AI never contact Cloudflare.
  - The widget is invisible unless Cloudflare asks for an interaction; then it appears in the bottom-right corner, labelled "Security check".
  - Without the site key nothing loads, and a page can still provide `window.atlasTurnstileToken = async () => token` itself.
  - Tested in `tests/e2e/ai.spec.ts` with a stand-in widget.
- **Logging:** one JSON line per request, with time, tier, model, character count, message and image counts, the JSON flag, stop reason, token counts, status, error code and duration. **No prompt, reply or IP is ever logged.**

## Cost

Rates as of November 2026 (check https://platform.claude.com/docs/en/about-claude/pricing):

| Model | Input | Output |
|---|---|---|
| Claude Opus 5.5 | $4 / M tokens | $20 / M tokens |
| Claude Haiku 5.5 | $0.10 / M tokens | $0.50 / M tokens |

Rough cost per `default`-tier request (about 4 characters per token):

| Request | Input | Output (incl. thinking) | Cost |
|---|---|---|---|
| Typical (Ask the Atlas with page context) | 3,000–6,000 tokens | 400–1,500 tokens | **about $0.02–0.05** |
| Worst case (30,000 characters in, 1,500 out) | about 7,500 tokens | 1,500 tokens | **about $0.06** |

Ceilings:

- **Per day:** at most `DAILY_REQUEST_CAP` × $0.06, which is about **$30/day** at the default of 500.
- **Per visitor:** at most 100 requests a day, which is about $6.
- **Quick-tier calls** (the routing playground) cost a fraction of a cent.

Set a monthly spend limit on the Anthropic Console as well, because that's the hard stop.

## Turning it on (Cloudflare Pages)

1. **API key:** create one in the Anthropic Console for a dedicated workspace with a spend limit.
2. **KV:** in Cloudflare, go to Workers & Pages → KV, create a namespace (for example `atlas-ai-rate`), then bind it to the Pages project as **`RATE_KV`** (Settings → Functions → KV namespace bindings).
3. **Secrets** (Settings → Variables and secrets, type Secret): `ANTHROPIC_API_KEY`, `IP_HASH_SALT` (any random string), and optionally `TURNSTILE_SECRET` (with `PUBLIC_TURNSTILE_SITE_KEY` as a plain variable).
4. **Variables:**

   | Variable | Value |
   |---|---|
   | `CLAUDE_MODEL_DEFAULT` | `claude-opus-5-5` |
   | `CLAUDE_MODEL_QUICK` | `claude-haiku-5-5` |
   | `SITE_ORIGIN` | `https://your.domain` (add the `*.pages.dev` preview origin if you test there) |
   | `DAILY_REQUEST_CAP` | `500` |
   | `RATE_LIMIT_PER_HOUR` | `20` |
   | `RATE_LIMIT_PER_DAY` | `100` |
   | `CLAUDE_EFFORT` | `low` (optional) |
   | `PUBLIC_AI_ENABLED` | `true` (build-time: compiled into the site and makes the AI buttons appear) |
5. **Redeploy.** Then check the result in the browser: Ask the Atlas appears on content pages, and the **Privacy** page switches to its "AI features are on" wording automatically.

To turn it off, set `PUBLIC_AI_ENABLED=false` and redeploy. The buttons disappear even if the function stays deployed. Revoke the key as well if you want the proxy itself dead.

## Vercel (alternative)

`api/claude.ts` in a Vercel project. The edge runtime gives you `Request`/`Response`, and the KV calls map to Upstash Redis or Vercel KV:

```ts
// api/claude.ts (Vercel Edge Function)
import { handle, type KV } from '../functions/_lib/claude-proxy';
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const RATE_KV: KV = {
  get: (k) => kv.get<string>(k).then((v) => (v == null ? null : String(v))),
  put: (k, v, o) => kv.set(k, v, o?.expirationTtl ? { ex: o.expirationTtl } : undefined).then(() => undefined),
};

export default (request: Request) => handle(request, { ...(process.env as any), RATE_KV });
```

- **Client IP:** Vercel passes it in `x-forwarded-for` / `x-real-ip`, which the proxy reads.
- **Environment variables:** set the same ones in the project settings.
- **Netlify:** same idea with `netlify/functions/claude.ts` and Netlify Blobs, or Upstash, for the counters.

## Tests

| What | Command or file |
|---|---|
| Proxy unit tests: success path, model and tier selection, caps, the `max_tokens` = 1,500 cap, effort, fallbacks, JSON mode, images, CORS, per-IP/daily/global limits, IP hashing, Turnstile, upstream error mapping, and logs without prompt or reply text | `npm run test:unit` |
| The browser side against a mocked proxy | `tests/e2e/ai.spec.ts` |
