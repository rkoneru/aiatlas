# Mobile and browsers (Phase 6)

## Results (Chromium at 375, 768 and 1280 px)

| Check | Result |
|---|---|
| Pages that scroll sideways | 0 of 103, at every width |
| Wide tables | 55 at 375 px, all scrolling inside their card |
| Diagrams | At phone widths (≤ 640 px) every diagram is re-laid-out top to bottom and fits the screen, except two with hand-placed connectors (see "Phone layout" below). Stepping and tapping work. |
| Sidebar | Below the breakpoint it collapses to a "☰ Menu" button and opens as a drawer (`aria-expanded` updates). Choosing a page closes it. |
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

### Text folds under its heading

**Code:** `src/lib/collapse-inline.ts`, an inline script in `BaseLayout`.

- **What folds:** sections made only of text (cards, tables, lists, callouts) collapse under their h2, which becomes a button with `aria-expanded` and a chevron.
- **What stays open:** a section with a diagram, a form control, a canvas, a button or a runtime-filled container (anything with an `id`), so calculators and tools are always visible.
- **Merged sub-pages:** handled separately, so each keeps its own folds.
- **Timing:** the script runs before first paint on the server-rendered page. It runs again when the runtime restores the original markup, so folding causes no layout shift.
- **Reopening:** a search highlight or a link that points inside a folded section opens it.

### App layout (trial on `/agentic-coding/`)

**Code:** `src/lib/collapse-inline.ts` (`APP` lists the pages using it) and `src/styles/site.css` ("App layout on phones").

On these pages nothing is hidden at section level, and only the detail is collapsible:

- **Section tabs:** a sticky bar under the app bar, one tab per section. The section in view is highlighted, and the bar ends with **Expand all / Collapse all**.
- **Section headings:** grouped-list style headers.
- **Tiles (cards):** each tile shows its tag, title and a two-line preview. Tapping anywhere on it opens the full text, and the title is a button with `aria-expanded`.
- **Tables:** each row becomes its own card. The first column is the title, the next column shows as a one-line preview with its column name, and tapping opens all columns, each labelled with its column name.
- **Tools and diagrams:** cards holding tools, forms or runtime-filled content are left as they are.
- **Timing:** all of this happens before first paint and again after the runtime restores the page, so there's no layout shift.
- **Accessibility:** axe reports 0 violations at 390 px, light and dark, collapsed and expanded.

Other pages keep the section folding below until the trial is approved. To switch a page over, add its id to `APP`.

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
- `375-drawer-open.png`

## Browsers

`tests/e2e/mobile.spec.ts`, `pages.spec.ts` and `cross-page.spec.ts` run in Chromium, Firefox and WebKit. In CI (`.github/workflows/ci.yml`) Firefox and WebKit are enabled with `ATLAS_ALL_BROWSERS=1`. This development environment can't download them (the browser host is blocked by its network policy), so Firefox and WebKit results come from CI.
