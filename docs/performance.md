# Performance (Phase 3)

## Results

### Lighthouse, mobile

Final run for the three target pages; the other rows are from the same build before the last small fix. Default Lighthouse 12 mobile settings (simulated slow 4G, 4× CPU slowdown), local gzip server (`tests/static-server.mjs`). Re-run with `npm run lighthouse` after `npm run build` while a server is running.

| Page | Performance | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` | **96** | 1.7 s | 2.7 s | 50 ms | 0 |
| `/rag/` | **94** | 1.8 s | 2.8 s | 70 ms | 0 |
| `/cx-metrics/` | **95** | 1.8 s | 2.8 s | 20 ms | 0 |
| `/mcp/` | 94 | 1.8 s | 2.9 s | 30 ms | 0 |
| `/patterns/` | 94 | 1.8 s | 2.8 s | 30 ms | 0 |
| `/agents/` | 92 | 2.1 s | 3.0 s | 70 ms | 0 |
| `/fde-discovery/` | 98 | 1.4 s | 2.2 s | 10 ms | 0 |

### Before Phase 3

`/` scored 54 (FCP 3.9 s, CLS 1.3), `/rag/` 60 and `/cx-metrics/` 56.

### JavaScript per page

Gzipped. See `src/generated/runtime/report.json` after a build.

| | Before | After |
|---|---|---|
| Runtime | 400 KB on every page (the whole Atlas) | 88–127 KB (median 90 KB), only that page's code |
| Boot + platform shim + accessibility enhancer | — | 8.4 KB, every page |
| Infographic studio | (in the runtime) | 11 KB, loaded on first click of an Infographic button |

Totals, boot included (103 pages, after the v23 update):

| Page | Total JS (gzipped) | Budget (150 KB) |
|---|---|---|
| Content pages (`/`, `/rag/`, `/cx-metrics/`, …) | 96–102 KB | Under |
| `/proposal/` | 135 KB (126.5 KB runtime) | Under |
| `/industry/` | 127 KB (118.7 KB runtime) | Under |
| `/ai-board/` | 122 KB (113.7 KB runtime) | Under |

Every page is now under budget. `/proposal/` was about 1.5 KB over until two pruning steps were added in v23:
- the release log ships only on `/changes/`;
- data built with the `Q()` diagram helper is tree-shaken when nothing reads it.

## How

### 1. Per-page runtimes (`scripts/build-runtime.ts`)

Each page's runtime is the full runtime minus code that the original would skip on that page, then tree-shaken. Statements keep their original order. Removed:

- **The release log:** `CHANGES` is emptied on every page except `/changes/`, the only place it's rendered.
- **Other pages' code:** code guarded by another page's element (`if(document.getElementById('x'))…`, or `if(!$('x')…)return` at the top of an IIFE, after side-effect-free declarations).
- **Off-page fallbacks:** `const X=(()=>{if(!$('x'))return {stub};…})()` becomes `const X={stub}` when `#x` is absent.
- **Unused diagrams:** `DEFS.key=…` definitions not used by the page's `data-flow` hosts or remaining code, plus per-page formula entries (`FM`) for absent pages.
- **Other pages' branches:** checks on the current page (`ATLAS.page==='x'`, `ATLAS.hash()==='#x'`) are folded, and the dead branches dropped.
- **Unreferenced declarations:** at top level and inside IIFEs, when their initializer has no side effects. Calls to the diagram builders `N()`, `E()` and `Q()` count as side-effect free; `Q()` only while the runtime still defines it as the one-line wrapper around `N()`.

Minification is whitespace plus syntax only. Identifiers are not renamed, because the diagram exporter serializes `Flow`, `sv`, `esc` and others with `toString()`.

### 2. Lazy infographic studio

On every page except `/playground/`, the Infographic button loads `infographic.js`, which carries its own `#igStudio` markup. Before Phase 3, that markup was attached to every page as a companion.

### 3. Build-time snapshot (`scripts/snapshot.mjs`, decision Q1)

After `astro build`, each page is rendered in headless Chromium, and its rendered section goes into the HTML. The original markup moves to `<template id="atlas-src">`. The runtime's first statement restores it, so the runtime sees exactly what it always saw.

Effects:

- **Content in the HTML:** all of it is in the HTML before JavaScript runs, including the diagrams and tables that 46 pages drew only with JS. That covers crawlers, link previews and no-JS readers.
- **No layout shift (CLS 0):** containers that are filled by a timer a moment after load keep their snapshot content until they're redrawn (`data-keep`). For example, the path cards on `/`.
- **Self-checking:** the snapshot step reloads every page and requires the final state to equal the state without the snapshot. Where it doesn't, it falls back to a plain restore. Today that applies to 11 tabbed diagram pages, which still score 92–94.
- **Links:** links the runtime draws as `#page` are real URLs in the snapshot.

### 4. Loading

- Scripts are `defer`: same order, still before `DOMContentLoaded`, without blocking first paint. `ATLAS.after()` runs on `DOMContentLoaded`.
- The font stylesheet is inlined (`build.inlineStylesheets: 'always'`), so no CSS request blocks rendering. The Atlas CSS was already inline.

## Differences from the brief's suggested method

The brief suggested moving `AC`, `CMOD`, `CQ`, `FM` and `DEFS` to JSON modules imported where needed, and splitting into ES modules per feature. I didn't, because the runtime is one classic script sharing 217 global names and many closure-local helpers. Turning it into modules means rewriting how those pieces reference each other, which is exactly what the parity test exists to prevent.

The per-page build gets the same result, with each page shipping only its data and features, and the code unchanged:

| Data | Where it ends up |
|---|---|
| `DEFS` | Pruned per page, down to that page's diagrams. |
| `FM` | Pruned to the page's own formulas. |
| `CQ` | Only on `/course/` (through the `route-course` patch). |
| `AC`, `CMOD` | Stay on every page. Glossary tooltips, search concepts, the "Practice this page" button and the course bar all use them. |

### Trade-off

Each page has its own runtime file, so moving between pages downloads a new 107–145 KB file instead of reusing a cached one. The first page is fast. A shared cached core is possible later, once the code is split into real modules.

### Companions

These stay for the CAIO pages, the board, industry and proposal pages. They are inert HTML in a `<template>`, a few KB per page.

## Checks

| Check | What it compares |
|---|---|
| `tests/e2e/parity.spec.ts` | Every page's per-page runtime against the original single file. |
| `tests/e2e/pages.spec.ts` | Zero console errors on every page. |
| `tests/e2e/cross-page.spec.ts` | Cross-page features, including the lazy infographic. |
