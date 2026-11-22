# AI Architecture Atlas — website

The interactive learning site about AI architecture, built as a static Astro site from the single-file Atlas in `source/atlas.html`.

> Work in progress: see the phase plan in `docs/`. A full README, with deploy steps, comes in Phase 9.

## Commands

```bash
npm install
npm run extract           # source/atlas.html -> src/content, src/data, src/styles, src/generated, public/
npm run extract:analyze   # re-compute page guards (needs Playwright's Chromium); run after big source changes
npm run build             # -> dist/  (AI off unless PUBLIC_AI_ENABLED=true; see .env.example)
npm run build:ai-test     # -> dist-ai/ with AI on, for the mocked-proxy tests
npm run build:gh-test     # -> dist-gh/ built for GitHub Pages under /aiatlas/
npm run dev               # local dev server
npm run check:links       # internal link check over dist/
npm run test:e2e          # Playwright: page loads, parity with the original, cross-page features
```

## Hosting on GitHub Pages

`.github/workflows/pages.yml` builds the site on every push and deploys the default branch to GitHub Pages.

1. One-time: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Push, or run the workflow by hand from the Actions tab. The site is served at `https://<owner>.github.io/<repo>/`.
3. For a custom domain:
   - Add the domain in Settings → Pages.
   - Set the repository variables `PAGES_BASE` to `/` and `PAGES_SITE_URL` to `https://your.domain`.

Differences from Cloudflare Pages:

| Feature | GitHub Pages | Cloudflare Pages |
|---|---|---|
| Retired page paths (`/rag-math/`) | Generated redirect pages | Server-side `_redirects` |
| AI proxy (`/api/claude`) | Not possible, so AI stays off | Runs as a Pages Function |

## How content flows

`source/atlas.html` is the content of record. `npm run extract` moves it into the project programmatically and never rewrites page text. The runtime changes it makes are listed in [`docs/runtime-adaptations.md`](docs/runtime-adaptations.md).

## Docs

| File | What it covers |
|---|---|
| [`docs/inventory.md`](docs/inventory.md) | Phase 0 inventory, generated. |
| [`docs/inventory-findings.md`](docs/inventory-findings.md) | What blocked a clean split, and how each blocker is handled. |
| [`docs/decisions.md`](docs/decisions.md) | Decisions made so far. |
| [`docs/runtime-adaptations.md`](docs/runtime-adaptations.md) | How the original runtime works on one URL per page. |
| [`docs/platform.md`](docs/platform.md) | The `window.claude.use()` shim: downloads, voice-over, AI, Team mode. |
