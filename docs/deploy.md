# Deploying

The site is static HTML, CSS and JS in `dist/`, built by `npm run build`. Two hosts are set up:

| | GitHub Pages (live now) | Cloudflare Pages (planned host) |
|---|---|---|
| Build | `.github/workflows/pages.yml` | Cloudflare's build, from the repo |
| Address | `https://<owner>.github.io/<repo>/`, or a custom domain | Custom domain, or `*.pages.dev` |
| Retired page paths | Generated redirect pages | `_redirects` (server-side 301), plus the redirect pages |
| AI proxy | Not possible | `functions/api/claude.ts` (see `docs/ai-proxy.md`) |

## Build requirements (any host)

- **Node:** 22.
- **Chromium:** `npm run build` renders every page once in headless Chromium for the snapshot (`scripts/snapshot.mjs`). Install it first with `npx playwright install --with-deps chromium`. That takes about 1 minute; the build itself takes about 3–4 minutes.
- **Output:** the `dist/` directory.

## Cloudflare Pages

### 1. Connect the repository

Workers & Pages → Create → Pages → Connect to Git, then pick `rkoneru/aiatlas` and set:

| Setting | Value |
|---|---|
| Production branch | The repo's default branch |
| Build command | `npx playwright install --with-deps chromium && npm run build` |
| Build output directory | `dist` |

If the Cloudflare build image can't install Chromium's system dependencies, there are two alternatives:

- Build with `npx playwright install chromium && npm run build` (without `--with-deps`).
- Or build in GitHub Actions and deploy the result with Wrangler instead: `npx wrangler pages deploy dist --project-name <name>`, using a Cloudflare API token stored as a GitHub secret.

### 2. Environment variables

Under Settings → Variables and secrets:

| Variable | Value | Note |
|---|---|---|
| `NODE_VERSION` | `22` | |
| `PUBLIC_SITE_URL` | `https://your.domain` | Canonical URLs, sitemap, share images. |
| `PUBLIC_AI_ENABLED` | `false` | Leave off at launch. |
| `PUBLIC_PLAUSIBLE_DOMAIN` | `your.domain` | Optional. Omit it for no analytics. |
| `PUBLIC_CONTACT_EMAIL` | your address | Optional. Otherwise `src/data/site.json` is used. |
| AI proxy variables | | Only when turning AI on; see `docs/ai-proxy.md`. |

Leave `ATLAS_BASE` unset on Cloudflare, so the site lives at `/`.

### 3. Custom domain

Custom domains → Set up a domain, and follow the DNS steps; Cloudflare issues the certificate. Then:

- Set `PUBLIC_SITE_URL` to that domain and redeploy, so canonical URLs and the sitemap use it.
- If you have the old single-file Atlas elsewhere, point people to the new address. Old `#rag`-style links work on any page of the new site.

### 4. Check after deploying

Open:

- `/`
- `/rag/`
- `/rag-math/` (should redirect to `/rag/#rag-math`)
- `/sitemap.xml`
- `/robots.txt`
- an unknown path (should show the 404 page with a search box)
- a page shared to a social preview tool (should show the 1200×630 share image)

## GitHub Pages

This is already set up. Settings → Pages → Source is "GitHub Actions", and `.github/workflows/pages.yml` deploys the default branch.

For a custom domain:

1. Add it under Settings → Pages.
2. Set the repository variables `PAGES_BASE=/` and `PAGES_SITE_URL=https://your.domain`.
3. Re-run the workflow.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | What runs |
|---|---|
| build | The three site variants: AI off, AI on (mocked proxy), and the `/aiatlas/` base path. |
| checks | Typecheck, proxy unit tests, internal link checks. |
| e2e | Playwright, sharded: Chromium (all specs), AI, GitHub Pages, Firefox and WebKit (page loads, mobile, cross-page). |
| lighthouse | Lighthouse CI on `/`, `/rag/` and `/cx-metrics/`. Accessibility and SEO are enforced; performance below 90 warns. |

Failing tests upload their traces and screenshots as artifacts.
