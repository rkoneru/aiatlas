# Mobile and browsers (Phase 6)

## Results (Chromium at 375, 768 and 1280 px)

| Check | Result |
|---|---|
| Pages that scroll sideways | 0 of 98, at every width |
| Wide tables | 55 at 375 px, all scrolling inside their card |
| Diagrams | Fit their box or scroll inside it. At 375 px the larger diagrams scroll horizontally within the diagram box, and stepping and tapping work. |
| Sidebar | Below the breakpoint it collapses to a "☰ Menu" button and opens as a drawer (`aria-expanded` updates). Choosing a page closes it. |
| Content clipped by `overflow: hidden` | None |

The original layout was already responsive, so these needed no changes.

## Fixes

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
