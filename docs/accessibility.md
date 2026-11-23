# Accessibility (Phase 5, WCAG 2.2 AA)

## Result

axe-core (WCAG 2.0/2.1/2.2 A and AA rules) on all 98 pages and the 404 page, in light and dark mode: **0 violations of any impact**.

- **How it's run:** with the page as first loaded. `tests/e2e/a11y.spec.ts` fails on any serious or critical violation.
- **Starting point (light mode):** 1,418 colour-contrast nodes, 617 diagram boxes whose accessible name missed their visible text, 325 unlabelled inputs and selects, 101 focusable diagram boxes inside an `img`, plus a handful of scroll-region, tab-role and target-size issues.

## What changed

### Declared patches

These are listed in `scripts/copy-patches.json` and applied to both sides of the parity test.

| Patch | Change |
|---|---|
| `a11y-diagram-group`, `a11y-sequence-group`, `a11y-landscape-group` | Diagram SVGs that contain focusable boxes are `role="group"` (labelled), not `role="img"`. |
| `a11y-node-name`, `a11y-node-text-space*` | A box's accessible name is its title and subtitle, and the visible text has a space between them. |
| `a11y-badge-hidden` | The decorative ✓ + ↑ badge on a box is `aria-hidden`. |
| `a11y-landscape-ring-name` | AI-landscape rings are named "AI: Artificial Intelligence", which starts with the visible abbreviation. |
| `a11y-pyramid-label` | Maturity pyramid labels sit on a solid chip. The bar's tint still shows the score. |

### Enhancer (`src/scripts/a11y.ts`)

It runs after the runtime, and again when the runtime redraws. It only adds things, and marks each addition (`.atlas-a11y`, `data-a11y`) so the parity test can strip them.

- **Labels:** inputs and selects without an accessible name get `aria-label` from their visible context: placeholder, preceding text, then the container's heading.
- **Scrolling:** scrollable regions without focusable content become focusable (`tabindex="0"`, `role="region"`, labelled), so keyboard users can scroll them.
- **Tabs:** tab lists get `role="tab"` and `aria-selected`.
- **Keys:** Enter and Space activate non-native `[role=button]` elements, such as sequence-diagram lanes.
- **Skip link:** "Skip to content" moves focus to `<main>` without a hash change, because the runtime routes on hash changes.
- **Text versions:** every diagram gets a collapsible text version with its title, boxes (title, subtitle, description), connections and steps. It's the same information as the Atlas's own `flowText()`, and it updates when a tab swaps the diagram.

### CSS (`src/styles/site.css`)

- **Light-mode accents** darkened to at least 6.2:1 on white:

  | Token | Before | After |
  |---|---|---|
  | purple | `#6b46f5` | `#6038f4` |
  | green | `#16924d` | `#116f3a` |
  | blue | `#2563eb` | `#1454df` |
  | orange | `#e0640f` | `#9f470b` |
  | pink | `#d02670` | `#b42161` |
  | teal | `#0d8f86` | `#0a6b65` |
  | amber | `#b7791f` | `#7a5114` |
  | gray | `#5f6b7f` | `#566173` |

  This fixes accent text on white, on the tinted backgrounds mixed from these colours, and white text on accent buttons. Diagrams in light mode look slightly deeper as a result.
- **Dark mode:** accent-filled controls (primary buttons, active chips and steps) use the dark page colour for their text instead of white.
- **Dimmed states:** states shown with 40–55% opacity (rows outside top-k, vetoed rows, the unselected scenario chip, future maturity stages) keep their meaning with muted or dashed styling at full opacity.
- **Focus:** visible focus everywhere (3 px outline). Diagram boxes show a 3.5 px blue stroke when focused.
- **Targets:** at least 24 × 24 px.
- **`prefers-reduced-motion: reduce`:** no animations or transitions, and no moving packets on diagram edges. Diagrams never auto-play; they only play when asked.

### Layout

There's a "Skip to content" link on every page, and `<main id="main" tabindex="-1">`.

## Not covered by automated checks

- **Rendered states:** axe checks pages as first loaded. States reached by interacting, such as every tab, every wizard result or opened dialogs, are only partly covered: the keyboard and text-version tests open some.
- **Screen readers:** no manual screen-reader pass (NVDA, VoiceOver) has been done.
- **Generated labels:** labels derived for 300+ controls are reasonable, but some could be worded better by hand. A label written in the source always takes precedence.
