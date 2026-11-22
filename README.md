# AI Architecture Atlas — website

The interactive learning site about AI architecture, built as a static Astro site from the single-file Atlas in `source/atlas.html`.

> Work in progress: see the phase plan in `docs/`. A full README, with deploy steps, comes in Phase 9.

## Commands

```bash
npm install
npm run extract           # source/atlas.html -> src/content, src/data, src/styles, src/generated, public/
npm run extract:analyze   # re-compute page guards (needs Playwright's Chromium); run after big source changes
npm run build             # -> dist/
npm run dev               # local dev server
npm run check:links       # internal link check over dist/
npm run test:e2e          # Playwright: page loads, parity with the original, cross-page features
```

## How content flows

`source/atlas.html` is the content of record. `npm run extract` moves it into the project programmatically and never rewrites page text. The runtime changes it makes are listed in [`docs/runtime-adaptations.md`](docs/runtime-adaptations.md).

## Docs

| File | What it covers |
|---|---|
| [`docs/inventory.md`](docs/inventory.md) | Phase 0 inventory, generated. |
| [`docs/inventory-findings.md`](docs/inventory-findings.md) | What blocked a clean split, and how each blocker is handled. |
| [`docs/decisions.md`](docs/decisions.md) | Decisions made so far. |
| [`docs/runtime-adaptations.md`](docs/runtime-adaptations.md) | How the original runtime works on one URL per page. |
