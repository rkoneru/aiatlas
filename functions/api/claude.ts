/**
 * Cloudflare Pages Function: POST /api/claude → Anthropic Messages API.
 * Off unless deployed with secrets and PUBLIC_AI_ENABLED=true in the site build. Setup: docs/ai-proxy.md.
 * Bindings: KV namespace RATE_KV; secrets ANTHROPIC_API_KEY (and optional TURNSTILE_SECRET, IP_HASH_SALT);
 * variables CLAUDE_MODEL_DEFAULT, CLAUDE_MODEL_QUICK, SITE_ORIGIN, limits.
 */
import { handle, type Env } from '../_lib/claude-proxy';

export const onRequest = (ctx: { request: Request; env: Env }) => handle(ctx.request, ctx.env);
