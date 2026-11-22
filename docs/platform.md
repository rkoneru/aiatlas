# Platform shim (`src/scripts/platform.ts`)

On claude.ai the Atlas called `window.claude.use(name)` for capabilities the page couldn't provide itself. On the website, the shim defines the same function with the same contract. It runs first on every page, bundled into `boot.js`, so the runtime is unchanged. The contract below was read from the call sites, not taken from the brief (see `docs/inventory-findings.md` B12).

| Capability | Resolves to | Built on |
|---|---|---|
| `downloads` | `{ save({filename, data}) }`. `data` is a string, Blob, ArrayBuffer or typed array. | Blob URL + `<a download>`. MIME type from the file extension. |
| `tts` | `{ speak(textOrLines, {voice, rate, language}), stop(), setRate(r), onState(cb), onLine(cb) }` | `speechSynthesis`. Rejects with `unavailable` when the browser has no speech synthesis, so voice-over stays hidden. |
| `sample` | `sample(promptOrMessages, {signal, modelTier, cache, onText, images}) → {text, truncated}`, `sample.json(…) → object`, `sample.limits()` | `POST /api/claude` (`PUBLIC_AI_ENDPOINT`). **Rejects unless `PUBLIC_AI_ENABLED=true` at build time**, so every AI button stays hidden, as it did on claude.ai when sampling was unavailable. |
| `db`, `user` | reject `unavailable` | Team mode is off (decision 4). It shows its existing "not available" state, and the Reuse library hides "add to shared library". |

## `tts` details

- **Lines:** `speak(lines)` takes `[{text, id}]`. It speaks each line in order and calls `onLine({id})` as each one starts. That callback is what moves the diagram to the step being read.
- **Chunking:** each line is split into sentence-sized utterances, because long utterances stall in some browsers.
- **Promise:** resolves when speaking finishes or is stopped.
- **State:** `onState({state, reason})` reports `speaking` and `idle`. The reasons are `done`, `stopped`, `no_gesture` and `unavailable`.
- **Voices:** the four voice names (Buttery, Airy, Glassy, Rounded) map onto up to four installed English voices. Local voices are preferred.
- **Speed:** `setRate` applies from the next utterance.

## `sample` details

### Request body (`POST /api/claude`)

```json
{ "prompt": "…" | "messages": [{ "role": "user", "content": "…" }],
  "json": false, "tier": "default" | "quick",
  "images": [{ "media_type": "image/png", "data": "<base64>" }] }
```

### Response

| Case | Body |
|---|---|
| Success | `{ "text": "…", "truncated": false }` |
| Error | `{ "error": { "code": "rate_limited", "message": "…" } }`, with any HTTP status. |

### Error codes

Errors are `Error` objects with `.code` (and `.text` where there is partial output). These are the codes the UI already handles:

| Code | When |
|---|---|
| `cancelled` | `signal` aborted |
| `rate_limited` | HTTP 429 or the proxy says so |
| `prompt_too_large` | HTTP 413 |
| `invalid_json` | `sample.json` reply couldn't be parsed (the reply is in `.text`) |
| `empty_completion` | the reply was empty |
| `image_rejected` | wrong type or over 3.75 MB |
| `unavailable` | network or server error, or AI turned off |

### Other behaviour

- **JSON replies:** `sample.json` tolerates code fences and prose around the JSON.
- **Streaming:** the proxy doesn't stream, so `onText` is called once with the full text.

## Tests

| What | File |
|---|---|
| Flag off: capability contract, downloads, voice-over (with a fake `speechSynthesis`), neutral wording | `tests/e2e/platform.spec.ts` |
| Flag off: no AI controls | Also in `platform.spec.ts`. On all 98 pages the visible buttons must equal the original's with no Claude capabilities at all. Voice-over is the only exception. |
| Flag on (`npm run build:ai-test` → `dist-ai/`), against a mocked `/api/claude` | `tests/e2e/ai.spec.ts`: Ask the Atlas, "Generate with Claude", "Improve with Claude", and the `rate_limited`, `invalid_json`, `cancelled` and `unavailable` paths |
