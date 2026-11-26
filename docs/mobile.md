# Mobile and browsers (Phase 6)

## Results (Chromium at 375, 768 and 1280 px)

| Check | Result |
|---|---|
| Pages that scroll sideways | 0 of 103, at every width |
| Wide tables | 55 at 375 px, all scrolling inside their card |
| Diagrams | At phone widths (≤ 640 px) every diagram is re-laid-out top to bottom and fits the screen, except two with hand-placed connectors (see "Phone layout" below). Stepping and tapping work. |
| Navigation | Phones (≤ 640 px): a bottom bar and an Explore sheet (see "Navigation" below). Tablets (641–860 px): the sidebar collapses to a "☰ Menu" drawer. |
| Content clipped by `overflow: hidden` | None |

The original layout was already responsive, so these needed no changes.

## Phone layout (≤ 640 px)

Phones get a layout built around the diagrams, with the text folded away until it's wanted. Tablets and desktops are unchanged.

### Diagrams laid out top to bottom

**Code:** `src/scripts/mobile.ts`.

Atlas diagrams are drawn on a canvas 1,000 units wide. On a phone that meant sideways scrolling inside the diagram box, with only a third of the diagram visible. Now each diagram is re-laid-out before it's drawn:
- A diagram that reads left to right (more columns than rows) is transposed: its columns become rows, read top to bottom, and its rows become up to three side-by-side lanes.
- Other diagrams keep their rows, with each row's boxes wrapped to the screen width.
- Boxes, connections, steps, captions, the details panel, voice-over and export are all unchanged. Groups (dashed boxes) are redrawn around the same members.
- The runtime routes connectors from the boxes' positions, so they follow the new layout.

**When it runs:** a runtime patch (`flow-hook`, in `docs/runtime-adaptations.md`) installs the layout before the first diagram is drawn, so phones never see the wide version. Rotating the phone or resizing across the breakpoint redraws every diagram.

**No layout shift:** the build-time snapshot records each diagram's height at phone width as `--mar` on its container. Phones reserve that space from first paint, and CLS stays 0 in Lighthouse's mobile run.

**Exceptions:** two diagrams have hand-placed connector waypoints and keep their drawn layout, scrolling inside their box:
- `spar` on `/agents/`
- `mcpseq` on `/mcp-protocol/`

### Text folds under its heading (course, playground, Team mode)

**Code:** `src/lib/collapse-inline.ts`, an inline script in `BaseLayout`.

- **What folds:** sections made only of text (cards, tables, lists, callouts) collapse under their h2, which becomes a button with `aria-expanded` and a chevron.
- **What stays open:** a section with a diagram, a form control, a canvas, a button or a runtime-filled container (anything with an `id`), so calculators and tools are always visible.
- **Merged sub-pages:** handled separately, so each keeps its own folds.
- **Timing:** the script runs before first paint on the server-rendered page. It runs again when the runtime restores the original markup, so folding causes no layout shift.
- **Reopening:** a search highlight or a link that points inside a folded section opens it.

### Navigation (bottom bar + Explore)

**Code:** `src/scripts/mobile.ts` (`appNav`, `openNav`) and `src/styles/site.css` ("Phone navigation").

On phones (≤ 640 px) the sidebar drawer is replaced by app-style navigation. The desktop and tablet sidebar are unchanged.

- **Bottom bar,** always visible, with four 54 px targets:
  - **Home** and **Course**, which also show which page you're on;
  - **Explore**, which opens the sheet below;
  - **Search**, which opens the full-site search.
- **The Explore sheet** (a native `<dialog>`, 88% of the screen; swipe down, ×, the backdrop or Esc close it):
  - **Find a page:** filters page titles as you type. If nothing matches, it offers a full-text search for the same words (`ATLAS.search(q)`).
  - **You're here:** the current page and its topic. Tapping it opens that topic.
  - **Tools:** the four pinned tools as icon tiles.
  - **Topics:** the 15 groups as icon tiles with page counts. Tapping one lists its pages, with the current page marked (`aria-current`) and a back button.
- **Always in step:** the sheet is built from the sidebar's own markup (`#nav`) each time it opens, so it matches the desktop menu, including "My pages".
- **Slimmer app bar:** the logo and title only.

**Checks:** axe reports 0 violations, light and dark, with the bar, the sheet, a topic and an empty filter. Tested in `tests/e2e/mobile.spec.ts`.

### Screen layout (every page)

**Code:** `src/lib/collapse-inline.ts` (`screen`, `tabHeads`, `flowMore`) and `src/styles/site.css` ("Screen layout on phones").

Every page except the course, the playground and Team mode (`NOT_APP`) is laid out to read like an app screen. It builds on the app layout below:

- **Compact header:** the label, the review date and the Infographic button sit on one line. The title is shorter, and the summary is two lines with "Read more".
- **Diagrams:** one row of controls: Play, ‹ Prev, Next › and **⋯**. The ⋯ button reveals the Diagram/Sequence switch, Reset, the step list, voice-over and export.
- **Sections as tabs:**
  - **How sections are found:** each top-level `h2`, and each merged sub-page (a wrapper with its own headings), becomes one tab in a segmented bar (`role="tablist"`; arrow keys work).
  - **One at a time:** only the chosen section shows.
  - **Pages without tabs:** pages with fewer than two sections show everything, as before.
- **Links and search into another tab:** a link, an old address (`/rag/#rag-math`) or a search highlight that points into another tab selects that tab first, then scrolls to the target.
- **Hidden diagrams:** diagrams in tabs that start hidden are drawn up front and appear correctly when their tab opens.

**Length on an iPhone 13** (tallest tab; two screens are 1,688 px):
- **17 pages** fit in two screens, and **38** in three.
- **Median:** about 3,000 px.
- **Long pages:** what stays long are interactive tools (calculators, playgrounds, quizzes) and merged sub-pages with their own diagrams and tools. The extreme cases are AI Acumen's rating list (308 cards) and the glossary (308 terms).

**Checks:** axe reports 0 violations, light and dark. The page sweep (`tests/e2e/mobile.spec.ts`) checks that no page scrolls sideways and that the trial page fits in two screens.

### App layout (every page)

**Code:**
- `src/lib/collapse-inline.ts`: builds the tiles before first paint.
- `src/scripts/mobile.ts`: the bottom sheet and the section tabs.
- `src/styles/site.css`: "App layout on phones" and "Bottom sheet".

Every page except the course, the playground and Team mode (`NOT_APP`) reads like an app screen: short and scannable, with detail one tap away.

- **Icon tiles:** text cards and table rows become a two-column grid of small tiles (about 60 px tall). Each tile has an icon chosen from its title (code, test, shield, people, metrics and so on), its label if it has one, and a two-line title.
- **Lists the runtime draws** (glossary, agent catalogue, release log, roadmaps…) become tiles too:
  - **When:** on the first render, and again as the runtime's last statement (`AFTER` in `scripts/build-runtime.ts`), before paint.
  - **Filters:** a search or filter that redraws the list rebuilds its tiles, so the glossary search works the same.
- **Bottom sheet:** tapping a tile opens its full content. Cards show their text; table rows show every column with its name.
  - **Previous / Next** step through the tiles of that group, with a counter ("2 of 6").
  - **Closing:** ×, the backdrop, Esc, or a swipe down on the sheet header.
  - **Built on `<dialog>`:** the sheet is a native `<dialog>` opened with `showModal()`, so focus is trapped and returns to the tile.
- **Long text:** paragraphs and callouts over about 140 characters are clipped to two or three lines, and "Read more" opens them in the sheet.
- **Section tabs:** a sticky bar under the app bar jumps between sections and highlights the one in view.
- **What stays as it is:**
  - anything with form controls or buttons (calculators, quizzes, rating cards such as AI Acumen's);
  - diagrams;
  - stat boxes (numeric titles);
  - containers the runtime fills with a single result.
- **Hidden originals:** the original cards and tables stay in the page, hidden on phones, so search, crawlers and the sheet use the same content. A search match inside one opens its sheet.

**Page heights at 390 px:**

| Page | Before | After |
|---|---|---|
| `/glossary/` | 54,800 px | 16,800 px |
| `/changes/` | 11,000 px | 4,700 px |
| `/agent-catalog/` | 10,300 px | 4,500 px |
| `/agentic-coding/` | 4,900 px | 3,000 px |

### Back button, diagram details and remembered tabs

- **Back closes popups.** Opening a tile's sheet or the Explore sheet adds a history entry, so the phone's back button or gesture closes the sheet and stays on the page. Closing it another way (×, Esc, tapping outside) removes that entry again, so the next back goes to the previous page. A link followed from a sheet steps back first, then navigates, so no extra entries pile up.
- **Diagram boxes open in the sheet.** Tapping a box (or Enter or Space on it) shows its title, subtitle and description in the bottom sheet. Previous and Next walk the boxes. The panel under the diagram, which was usually off-screen, is hidden on phones.
- **The section tab is remembered.** The chosen tab goes in the address as `?tab=<name>` (for example `/agentic-coding/?tab=good-and-poor-fits`), so a reload keeps it and the link can be shared. It is also kept in `sessionStorage` (`atlas-tab:<page>`) for the rest of the visit, so going back to a page returns to its tab.

### Compact type and controls

- **Type:** headings and the lead paragraph are smaller, so the first diagram is on the first screen.
- **Step chips:** they scroll in one row instead of wrapping into several.

All in `src/styles/site.css`, under "Phone layout".

### Tests

In `tests/e2e/mobile.spec.ts`:
- diagrams are re-laid-out and fit at 390 px;
- text sections fold and unfold, and a highlight inside reopens them;
- sections with tools stay open;
- nothing changes at 1280 px.

## Earlier fixes (Phase 6)

All in `src/styles/site.css`:

- **Shrunk checkboxes:** checkboxes and radios inside flex labels were squeezed to 13–23 px wide on narrow screens. They no longer shrink.
- **Sliders:** range sliders have a 24 px-tall hit area.
- **Badges:** "Last reviewed" badges are 24 px tall.
- **Touch screens** (`pointer: coarse`):
  - Checkboxes and radios are 24 px.
  - Chips, tabs, buttons and nav rows are at least 32 px tall.
  - ✕ remove buttons, Flow Studio chips and LLM-roles cells are at least 28 px.
  - "→ page" links in AI Acumen are padded.

The remaining targets under 24 px are inline links in running text, or controls inside a larger clickable label. Both meet WCAG 2.5.8 through its inline and spacing exceptions, and axe's `target-size` rule passes on every page.

## Screenshots (375 px)

`docs/screenshots/`:

- `375-home.png`
- `375-agents.png`
- `375-cx-metrics.png`
- `375-fde-discovery.png`

## Browsers

`tests/e2e/mobile.spec.ts`, `pages.spec.ts` and `cross-page.spec.ts` run in Chromium, Firefox and WebKit. In CI (`.github/workflows/ci.yml`) Firefox and WebKit are enabled with `ATLAS_ALL_BROWSERS=1`. This development environment can't download them (the browser host is blocked by its network policy), so Firefox and WebKit results come from CI.
