# AI Architecture Atlas

An interactive learning site about AI architecture. It covers:

- RAG, agents, MCP and A2A
- prompting
- LLMOps and governance
- CAIO strategy
- customer-service AI
- an FDE delivery kit

The site has 103 pages, animated diagrams, calculators, a course, practice, a glossary and search. It's built as a static Astro site from the single-file Atlas in `source/atlas.html`, which stays the content of record.

- **Live:** https://rkoneru.github.io/aiatlas/ (GitHub Pages). Cloudflare Pages is also ready: see `docs/deploy.md`.
- **Content:** © Rakesh, CC BY-NC 4.0 (`LICENSE-CONTENT.md`).
- **Code:** MIT (`LICENSE`).

## Updating content

1. **Edit `source/atlas.html`.** This is the same single file as before: pages, diagrams, data, styles and scripts. Or edit the extracted files once you switch over (see below).
2. **Extract:**

   ```bash
   npm run extract
   ```

   This regenerates `src/content/pages/*.html` (each page, byte for byte), the nav, page and redirect data, the stylesheet, the runtime and the search index. It's re-runnable, and it never rewrites page text. The changes it makes to the runtime are listed in `docs/runtime-adaptations.md`.
3. **If extract warns that guards are stale** (after larger script changes), run:

   ```bash
   npm run extract:analyze
   ```

   Then review the diff of `src/data/guards.json`.
4. **Build:**

   ```bash
   npm run build
   ```

   The output goes to `dist/`. The build needs Chromium, because it renders every page once (`npx playwright install chromium`).
5. **Test:**

   ```bash
   npm run test:e2e
   ```

   The parity test compares every page against `source/atlas.html`. If a change is intentional, the test will show exactly where the pages differ.
6. **Commit and push.** CI runs, and the default branch deploys.

Larger content updates can be written as a script that edits `source/atlas.html` with exact, counted replacements, like `scripts/content/2026-11-trends.py` (the v23 update: five new pages and new sections). The script refuses to run twice.

Wording or accessibility fixes to Atlas text go in `scripts/copy-patches.json`, not in the extracted files. Each entry is a find/replace with an expected match count, and it's applied both to the build and to the original in the parity test.

**Switching to the extracted files as the source.** `src/content/pages/*.html`, `src/data/*.json` and `src/styles/atlas.css` are plain files. If you'd rather edit them directly, stop running `npm run extract`, since it would overwrite them. The runtime (`src/generated/atlas-runtime.js`) is still generated from `source/atlas.html`.

## Commands

```bash
npm install
npx playwright install chromium   # once: the build and the tests use it
npm run extract                   # source/atlas.html -> project files
npm run build                     # -> dist/ (AI off unless PUBLIC_AI_ENABLED=true; see .env.example)
npm run build:ai-test             # -> dist-ai/ with AI on (for the mocked-proxy tests)
npm run build:gh-test             # -> dist-gh/ for GitHub Pages under /aiatlas/
npm run dev                       # local dev server
npm run typecheck
npm run test:unit                 # AI proxy unit tests
npm run test:e2e                  # Playwright: every page, parity, cross-page, a11y, mobile, SEO, AI, GH Pages
npm run check:links               # internal link check over dist/
npm run lighthouse                # Lighthouse on /, /rag/, /cx-metrics/ (needs a running server)
```

## Settings

See `.env.example`. These are `PUBLIC_*` variables, set at build time:

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Canonical URLs, sitemap and share images. |
| `PUBLIC_AI_ENABLED` | Off by default. Every AI button stays hidden until it's on. |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Analytics, only when set. |
| `PUBLIC_CONTACT_EMAIL` | The contact address. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Optional bot check on AI requests; see `docs/ai-proxy.md`. |

The AI proxy has its own server-side settings, listed in `docs/ai-proxy.md`.

## Docs

| File | What it covers |
|---|---|
| [`docs/todo-rakesh.md`](docs/todo-rakesh.md) | What needs your input. |
| [`docs/gap-analysis.md`](docs/gap-analysis.md) | AI trends gap analysis, and what the v23 update closed. |
| [`docs/deploy.md`](docs/deploy.md) | Cloudflare Pages and GitHub Pages deploys, and CI. |
| [`docs/decisions.md`](docs/decisions.md) | Decisions made. |
| [`docs/inventory.md`](docs/inventory.md), [`docs/inventory-findings.md`](docs/inventory-findings.md) | Phase 0 inventory, and what blocked a clean split. |
| [`docs/runtime-adaptations.md`](docs/runtime-adaptations.md) | How the original runtime runs with one URL per page. |
| [`docs/platform.md`](docs/platform.md) | The `window.claude.use()` shim: downloads, voice-over, AI, Team mode. |
| [`docs/performance.md`](docs/performance.md) | Per-page runtimes, snapshot, Lighthouse. |
| [`docs/seo.md`](docs/seo.md) | Titles, descriptions, share images, JSON-LD, sitemap, 404. |
| [`docs/accessibility.md`](docs/accessibility.md) | WCAG 2.2 AA work and results. |
| [`docs/mobile.md`](docs/mobile.md) | Mobile layouts, touch targets, browsers, screenshots. |
| [`docs/ai-proxy.md`](docs/ai-proxy.md) | The AI proxy: setup, costs, turning it on. |
