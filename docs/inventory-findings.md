# Phase 0 findings: what blocks a clean split

Companion to `docs/inventory.md` (generated). This file is written by hand. Line numbers (`L1234`) refer to `source/atlas.html` as committed in Phase 0.

## How this was checked

| Check | Script | Result |
|---|---|---|
| Static parse of HTML + inline script (acorn AST) | `scripts/inventory.mjs` → `docs/inventory.md`, `docs/inventory.json` | 98 pages, 29 merged aliases, 217 top-level globals, 12 `window.claude.use` call sites, 65 `atlas-*` storage keys |
| Original file, every page via `#hash` | `scripts/isolation-split-test.mjs` | 0 errors on all 98 pages |
| Script split into 399 classic `<script>`s (one per top-level statement, function declarations first), full DOM | same | 0 errors on all 98 pages. Splitting along top-level statements works without changing behavior |
| Same split, **only the current page's `<section>` in the DOM** (what a one-URL-per-page site serves) | same → `docs/isolation-split.json` | 85–95 uncaught errors on every page, from 95 top-level statements |
| Static vs rendered text per page | `scripts/render-coverage.mjs` → `docs/render-coverage.json` | 46 of 98 pages have less than half their text in the static HTML |

Re-run with `npm run inventory`, `npm run inventory:isolation` and `npm run inventory:coverage`.

## Structure in one paragraph

One 70 KB `<style>` (L9), static nav (L567–696), 98 `main > section` pages (L700–3845), and **one** 1.1 MB classic `<script>` (L3848–9930) with 399 top-level statements, 109 of them IIFEs. All top-level `const`/`let`/`function`/`class` names share one global lexical scope. Code before ~L6770 (releases ≤ 12) wires its page at top level with no guard. Code after that is mostly wrapped in `(function(){ if(!$('…'))return; … })()`. The other `<script>`/`<style>` text in the file sits inside JS template literals used by the exporters and is not run on load. There is no `fetch`, `eval`, worker or dynamic import. The only external resource is the Google Fonts stylesheet.

## Blockers and how I propose to handle each one

### B1. 95 unguarded page-init statements (34 pages)

The brief assumed most page init is already guarded. That is true only for code after ~L6770. Between L4708 and L6765, 95 top-level statements look up their page's elements and fail when that page isn't in the DOM. In the original single script, the first such failure stops everything after it, so every page breaks.

Each failing statement belongs to exactly one page. The isolation test shows each one passing only on its own page: ontology, a2a, mcp, patterns, rag, agents, optimization, rag-variants, mcp-protocol, agent-kit, workflows, reference-arch, jev, tool-call, voice, roadmaps, prompt-eng, prompt-debug, build-agent, agent-spectrum, agent-governance, prompt-skills, agent-catalog, pm-map, how-llms-work, guardrails, automation-ideas, ai-roles, sop-workflow, productivity, ai-landscape, llm-types, studio and maturity. `docs/isolation-split.json` → `failingStatements[].okOn` has the full list.

**Plan (Phase 1):** `extract.ts` wraps each of those expression statements in `if (ATLAS_PAGE === '<owner>') { … }`. The owner comes from the isolation test, which is re-run as a build check. Declarations (`const rt = document.getElementById(…)`) are left as they are: they just hold `null` on other pages. This adds guards and changes no logic.

### B2. One shared global scope

217 top-level names, many used across blocks (`FLOWS`, `DEFS`, `Flow`, `AC`, `CMOD`, `DL`, `VO`, `sections` and others; see "Globals" in `inventory.md`). Turning blocks into ES modules would make these names module-local and break the cross-references.

**Plan:** in Phase 1 the runtime ships as **one classic script**, the original statements in their original order, with the B1 guards. Same scope, same hoisting. In Phase 3 each split gets explicit imports and exports driven by the cross-block usage table.

### B3. Code that reads every page's DOM

- **Search index:** `SR_UI.build()` (L9596) runs `secText()` over all sections. It needs a prebuilt `search-index.json`.
- **Page counts and labels:**
  - "Type to search across all N pages" (L9600) and Team mode's "of N pages" (L9870) count `main>section`.
  - `navLabel()` falls back to another page's `<h1>`.
- **`sections` (L9907), `route()` and the two `curSec()` copies (L9084, L9495)** find the page with `!s.hidden`. With one section per URL, that becomes "the section that is present".
- **Per-page decoration:** the sources and review box (L8135) and the page-tools bar (L9515) are added to *every* section in a loop. On a single page this adds them to the one section, so it works as is.

**Plan:** a small `ATLAS` data object inlined per page: page list, titles, groups and the merged map. Search loads `/search-index.json` on first open. Page counts read `ATLAS.pages.length`.

### B4. `location.hash` used as "the current page"

Several places compare or assign `location.hash` as if it were the current page:

- **Compare:** L6459 (course quiz keys), L6757 (studio keys), L8074 (ai-board), L8107 (path bar), L8448 (playground), L9162 (proposal), L9320 (flaws), L9352 (certify), L9604 (search result), L9909 (route).
- **Assign to navigate:** L6404, L6458, L8106, L8419, L9464, L9466, L9604, L9708, L9729, L9800.
- **JS-built links:** templates such as `href="#${id}"` in the paths, course, glossary, search and changelog code can't be rewritten in the HTML.

**Plan:**
- `extract.ts` rewrites `location.hash==='#x'` and `!=='#x'` comparisons to `atlasIs('x')`.
- Assignments become `atlasGo(id)`, which sets `location.href='/<id>/'`.
- A delegated click handler turns any `a[href="#<page-id>"]` into a real navigation.
- The hash-redirect fallback from the brief catches anything left over.

### B5. Handoffs held in memory across pages

These handoffs keep their data in memory, then switch the hash. On a real page load that data is gone:

| Line | From → to | What is handed over |
|---|---|---|
| L9464 | page builder → playground | draft diagram via `__pgLoad` |
| L9800 | decision wizard → playground | generated diagram |
| L9729 | industry solutions → `#agent-roi` (merged into `usecase-roi`) | ROI preset via `window.__arSet` |
| L9708 | "Practice this page" → practice | page filter and mode |
| L9604 | search → page | term to highlight after navigating |

The course (L6404) and infographic (L8419) handoffs already save to `localStorage` first, so they survive the navigation.

**Plan:** one `sessionStorage` handoff (`atlas-handoff`, per tab, cleared once read), applied by the target page after init. This adds no new `localStorage` key.

### B6. Page builder "My pages" (`atlas-mypages-v1`)

Saved custom pages are added at load (L9099–L9115) as extra `<section>`s, a "My pages" nav group and extra `AC` concept cards. Their URL is `#<custom-id>` (ids prefixed `my-`). The `builder` page itself is reached only through that JS-built nav group.

**Plan:** saved pages render client-side on `/builder/` when the hash names a saved page (`/builder/#my-…`). The "My pages" nav group keeps working and links there. Creating new pages needs `sample`, so the button stays hidden while `PUBLIC_AI_ENABLED=false`. Pages saved by returning visitors can still be viewed.

### B7. Much of the content is drawn by JavaScript (affects SEO goal #2)

46 pages have less than 50% of their visible text in the static section HTML. The worst cases:

| Page | Text in static HTML |
|---|---|
| `course` | 0% |
| `glossary` | 0% |
| `acumen` | 1% |
| `changes` | 4% |
| `proposal` | 8% |
| `sop-workflow` | 12% |
| `agent-catalog` | 13% |
| `industry` | 13% |

The rest of their text comes from tables, tabs and cards built from data. A faithful split puts the static HTML in the page, and JS draws the rest just as it does now. Google renders JS, but other crawlers, link previews and the search index would miss that text.

**Options (decision needed, see Q1):**

- **(a) Build-time snapshot.** Prerender with headless Chromium, put the rendered section HTML in the page, and keep the original section HTML in a `<template>`. On load the runtime puts the original back before init, so the JS behaves exactly as now.
  - Pros: everything is indexable, and the page shows content before JS runs.
  - Cons: the HTML is about twice the size (it compresses well), and there is a re-render on load.
- **(b) Faithful split, plus a hidden text version.** Ship the static HTML only, and add a "Text version" block with the rendered text, which Phase 5 needs for diagrams anyway.
- **(c) Faithful split only.** Accept the gap.

**Recommendation:** (a), added in Phase 4. Phase 1 stays faithful. The search index is built from the rendered text either way.

### B8. The interactive diagram export depends on source text and `<style>` elements

`expHTML()` (L4089) rebuilds a standalone viewer from `Flow.toString()`, `sv.toString()`, `esc`, `N`, `E`, `voPlain`, `voStepText` and `voIntroText`. It also copies CSS from `document.querySelectorAll('style')`.

- **Constraint 1:** the bundler must not rename or minify-mangle those identifiers. The core runtime is built with `minifyIdentifiers: false`, and whitespace minification is still fine.
- **Constraint 2:** CSS must stay readable from a `<style>` element, or `expHTML` reads `document.styleSheets` instead. I'll inline the CSS in a `<style>` element in Phase 1 (about 13 KB gzipped).
- The slide, proposal and strategy exporters (L7991, L9154, L9158, L9852) build files the same way.

### B9. Third-party fonts

- The page loads Inter and JetBrains Mono from Google Fonts. I'll self-host both from `@fontsource` (OFL licence).
- The **downloaded** interactive HTML export also contains a Google Fonts `<link>` (L4094). That file isn't the site, but opening it contacts Google. See Q3.

### B10. "Resume where you left off" auto-redirect

If `/` has no hash, the page jumps to the `atlas-last` page (L9925). On a public site that hijacks the home page for returning visitors. See Q2.

### B11. Data tables inside closures

`GL`, `PATHS`, `FM`, `CHANGES` and `REVIEW` live inside IIFEs, not at top level. `DEFS` is built up over many statements, and some flow definitions run code (`roleDef()`, `aiDef()`). To move them to JSON in Phase 3, I'd evaluate them in a headless run and serialize the result, not parse the source. Phase 1 doesn't need this.

### B12. The capability contract is wider than the brief describes

From reading the call sites:

**`sample`** (L8446, L8462, L8596, L8915, L9480; Ask the Atlas at L9547):

- **Input:** accepts a **string or a messages array** (`[{role, content}]`).
- **Options:** `signal`, `modelTier` (`'default'`/`'quick'`), `cache:false`, `onText({text})` for streaming (Ask the Atlas and the compliance assistant), and `images:[File]` (page builder upload).
- **Returns:** `sample()` returns **`{text, truncated}`**, not plain text (L9547, L9057, L8996). `sample.json()` returns the parsed object.
- **Errors:** carry `.code` and sometimes `.text` (partial output). The UI handles these codes:

| Codes | Meaning in the UI |
|---|---|
| `cancelled`, `rate_limited`, `invalid_json`, `unavailable` | the four codes named in the brief |
| `not_granted`, `sampling_disabled`, `session_expired`, `refused`, `prompt_too_large`, `empty_completion`, `images_unavailable` | extra messages in the `COPY` tables |

**`tts`** (L4170):

- `speak(lines, {voice, rate, language})` returns a Promise that resolves when speaking finishes. `lines` is `[{text, id}]`, with ids `intro` and `s<k>`.
- `stop()` and `setRate(r)` both return Promises.
- The brief leaves out two calls the code needs:
  - `onState(cb)`, called with `{state:'idle'|…, reason}`.
  - `onLine(cb)`, called with `{id}` as each line starts. It drives which diagram step is highlighted.
- Voices are `buttery`, `airy`, `glassy` and `rounded`. They need mapping to whatever `speechSynthesis` voices the browser has.
- Error codes: `not_granted`, `no_gesture`, `rate_limited`, `busy`, `upstream_error`, `unavailable`.

**`downloads`:**

- `DL.save({filename, data})`, where `data` is a string or a Blob.
- `DLready` waits up to 10.5 s for the capability (L4032). The shim resolves immediately.
- Error code handled: `declined`.

**`db` + `user`:**

- Used by Team mode (L9855–L9897) **and also by the Reuse library's shared library (L9248)**. Turning them off hides the shared library's "add" option too. The UI handles `invalid_argument` and `quota_exceeded`.

The Phase 2 shim will implement all of the above, including `onState` and `onLine` on `speechSynthesis` events.

### B13. Copy that names claude.ai

About 16 UI strings tell visitors to "Open the Atlas on claude.ai", sign in to claude.ai or "Narrate … in a Claude voice":

- L3095 and L8991: shown on the page builder and LLM-judge pages when AI is unavailable, so **public visitors will see them at launch**.
- L4068, L4189, L7870, L8378, L9078, L9866–7 and others: download fallbacks, the voice-over tooltip and Team mode.
- L2951 and L8514 are page content about Claude Projects and sharing. They are intentional and I'll leave them alone.

The rules say not to change content, so these stay unless you say otherwise. See Q4.

## Things that are fine as they are

- All 29 `MERGED` aliases have a matching `<div id="…" class="merged">` on the target page.
- All `atlas-*` key names are string literals. 65 keys are listed in `inventory.md`, and none needs renaming.
- No static `href="#…"` points at an in-page anchor. All 247 point to a page (220) or a merged alias (27), so the build can rewrite them mechanically.
- Dark mode exists through `@media (prefers-color-scheme: dark)` (5 blocks). There is no manual theme toggle.
- There is **no** `prefers-reduced-motion` handling yet. Phase 5 adds it.

## Decisions I need from you before Phase 1

- **Q1 (B7, JS-rendered content).** Should I add the build-time snapshot (option a) in Phase 4? Recommended: yes.
- **Q2 (B10, home-page resume).** Recommended: `/` stays the home page and shows a "Continue where you left off: \<page\>" link. The alternative keeps the original auto-redirect.
- **Q3 (B9, exported HTML files).** Recommended: drop the Google Fonts `<link>` from downloaded exports so they fall back to system fonts. The alternative keeps it.
- **Q4 (B13, claude.ai copy).** Recommended: replace the strings that public visitors will see (L3095, L8991, the download fallbacks and the voice tooltip) with neutral wording such as "AI features are turned off on this site". Page content stays as it is. The alternative is to leave all of them.
