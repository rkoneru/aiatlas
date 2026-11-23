# Runtime adaptations

The Atlas runtime (`source/atlas.html`'s inline script) was written for one document that holds all 98 pages and switches between them by `#hash`. On the website every page is its own URL with only its own section in the HTML. Everything below makes the original code run there unchanged in behaviour. All of it is generated or applied by `npm run extract`; nothing in `src/generated/` is edited by hand.

The check that this works is `tests/e2e/parity.spec.ts`. It renders every page in the original file and on the built site with the same seeded `Math.random`, and requires the page's section HTML to be identical:

- after load
- after stepping every diagram
- after changing each input, select and checkbox on the page, up to 30 per page

## 1. Page guards (95 statements)

Between source lines ~4708 and ~6765, 95 top-level statements set up their page without checking it exists (see `docs/inventory-findings.md` B1). `scripts/extract.ts` wraps each one in:

```js
if(document.getElementById('<page>')){ …original statement… }
```

- **Where the list comes from:** `src/data/guards.json`, produced by `npm run extract:analyze` (`scripts/isolation-split-test.mjs`). That script loads each page with only its own section and records which statements fail and where they pass.
- **How statements are matched:** by a SHA-1 of the statement text, so edits elsewhere in the source don't move them.
- **When the list is stale:** if the source changes, `npm run extract` warns. Re-run `npm run extract:analyze` and check the diff of `guards.json`.

## 2. `location.hash`

| Original | Now | Effect |
|---|---|---|
| `location.hash` (11 reads) | `ATLAS.hash()` | Returns `#<current page>`, or the merged or custom-page id being shown on this page. |
| `location.hash = x` (10 writes) | `ATLAS.go(x)` | Navigates to `/<page>/`, or `/<page>/#<merged-id>`. On the current page it does what the hash change did. |

## 3. Text patches (`scripts/runtime-patches.ts`)

Each patch has an expected match count. Extraction fails if the source no longer matches, so a patch can't be silently skipped.

| Patch | What changes | Why |
|---|---|---|
| `nav-selector`, `nav-active`, `nav-mypages-*` | Nav lookups by `a[href="#id"]` now use `a[data-href="#id"]` | Nav links point to `/id/`. They keep the old `#id` in `data-href`. |
| `page-count` | `main>section` count → `ATLAS.pageCount()` | "Search across all N pages" and Team progress counted sections in the DOM. |
| `exists-*` | `$(id)` existence checks → `ATLAS.exists(id)` | Glossary links, wizard links, the changelog review table and the practice page filter listed only pages present in the DOM. |
| `navlabel-fallback` | `<h1>` lookup → `ATLAS.title(id)` | Labels for pages outside the nav came from that page's `<h1>`. |
| `group-fallback` | nav group → `ATLAS.group(id)` | The sources box picks references by nav group, and Team mode left the nav (decision 4). |
| `search-index`, `search-go`, `search-expose-highlight` | Search uses `/search-index.json` | The index holds the same text, extracted from the rendered original by `scripts/build-search-index.mjs`. A result on another page is highlighted after navigating. |
| `practice-stub`, `practice-expose` | "Practice this page" works from every page | Off the practice page the module was a no-op. It now opens `/practice/` filtered to the page. |
| `no-auto-resume` | `/` no longer jumps to the last page (decision Q2) | The home page shows a "Continue where you left off" link instead. |
| `flow-hook` | Calls `window.__atlasFlowHook(Flow)` just before the first diagram is drawn | Lets `src/scripts/mobile.ts` lay diagrams out top to bottom on phones. Does nothing above 640 px. |

### Wording changes (`scripts/copy-patches.json`, decisions Q3 and Q4)

- The downloaded interactive diagram no longer links Google Fonts.
- "Open the Atlas on claude.ai…" notices become neutral wording: page builder, LLM judge, download fallbacks and Team mode status.
- The voice-over tooltip no longer says "Claude voice".
- The Ask the Atlas footer says answers come "through this site".

The same list is applied to the original file in the parity test.

The page builder's notice sits in page content, so `src/content/pages/builder.html` is the one content file that differs from the source. All other content files are byte for byte.

## 4. `ATLAS` boot script (`src/scripts/boot.ts`)

A classic script that runs before the runtime on every page. It provides:

- **`ATLAS.hash()` and `ATLAS.go()`** (section 2 above).
- **Data about other pages:** `exists()`, `title()`, `group()`, `pageCount()` and `searchPages()`, read from JSON.
- **Old-link redirects:**
  - `/any/#rag` goes to `/rag/`, and `/any/#rag-math` goes to `/rag/#rag-math`.
  - An own-page `#rag` on `/rag/` is dropped from the URL.
  - Saved custom pages (`#my-…`) open on `/builder/#my-…`.
- **Link handling:** a click handler sends the runtime's own `href="#page"` links to real URLs.
- **Handoffs:** some buttons call a function that lives on another page and then navigate, such as "Open in playground" from the decision wizard, the page builder or the infographic studio. On other pages `window.__pgLoad` is a stand-in that queues the call. `ATLAS.go()` stores the queue in `sessionStorage` (`atlas-handoff`, per tab, cleared when read). `ATLAS.after()` replays it on the target page. Search highlights and practice filters use the same mechanism through `ATLAS.expose()`.
- **Resume link:** `atlas-last` is read before the runtime runs (the runtime overwrites it with the current page). `/` then shows a link back to that page.

## 5. Companions (`src/data/companions.json`)

A few modules serve several pages from one closure and read each other's DOM:

- **CAIO tools:** one module drives six pages and returns early unless `#caio` exists. The board pack reads the incident register. The proposal reads the ROI model and the decision wizard's result.
- **Infographic studio:** the Infographic button on every page renders through the studio on the playground page.

For these pages, the build adds the other pages' sections (or, for the studio, only `#igStudio`) in a `<template>`. The boot script clones them into a hidden, inert container outside `<main>` before the runtime starts.

- They are not part of the page's content.
- `main > section` still holds only the current page.
- Search engines don't index `<template>` content.
- `scripts/check-links.ts` ignores links inside them.

Since Phase 3 the infographic studio is no longer a companion. It ships with its lazy chunk (see `docs/performance.md`). The others remain: they are inert HTML, a few KB, and replacing them would mean restructuring the CAIO module.

| Page | Companions |
|---|---|
| `caio`, `ai-strategy`, `usecase-roi`, `ai-budget`, `ai-value` | the other CAIO pages |
| `ai-board` | the other CAIO pages, `incidents` |
| `industry` | the CAIO pages |
| `proposal` | the CAIO pages, `decide` |

## 6. What is generated from the source

| Output | From |
|---|---|
| `src/content/pages/<id>.html` | Each section's inner HTML, byte for byte. Links are rewritten at build time (`src/lib/site.ts`): `#id` → `/id/`, `#merged` → `/page/#merged`. |
| `src/data/pages.json`, `nav.json`, `redirects.json` | The sections, the nav and `MERGED`. |
| `src/styles/atlas.css` | The `<style>`, verbatim. It is inlined in a `<style>` element on every page because the exporters copy CSS from `<style>` elements. |
| `src/generated/atlas-runtime.js` | The script with sections 1–3 applied. Shipped unminified because the diagram exporter serializes `Flow`, `sv`, `esc` and others with `Function.prototype.toString()`. |
| `public/search-index.json` | The rendered text of every page. |
| `public/_redirects` | `/old-id/ → /page/#old-id`, `/overview/ → /`. |
