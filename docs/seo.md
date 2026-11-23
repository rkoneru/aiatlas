# SEO and sharing (Phase 4)

All metadata is derived from the extracted content (`src/lib/seo.ts`); nothing is written per page by hand.

## Per page

| Tag | Source |
|---|---|
| `<title>` | "Page title · AI Architecture Atlas", where the page title is the nav label, or the `<h1>` if the page isn't in the nav. The home page is "AI Architecture Atlas · How the pieces of an AI system fit together". |
| `<meta name="description">` | The page's `p.lead`, trimmed to 155 characters at a word boundary. `/course/` has no lead, so it uses the start of its rendered text from the search index. |
| `<link rel="canonical">`, `og:url` | `PUBLIC_SITE_URL` plus the base path plus the page path. |
| Open Graph, Twitter | `og:type` (`article`, or `website` on the home page), title, description, image (1200×630), `summary_large_image`. |
| `article:modified_time` | The page's "last reviewed" date from the Atlas's `REVIEW` data. 19 pages have one, and merged ids count toward their page. |
| JSON-LD | `Article` per page: headline, description, url, image, `articleSection` (nav group), `dateModified` when reviewed, author/publisher Rakesh. The home page has `WebPage` plus `WebSite` with a `SearchAction`. |
| `noindex` | `/team/` (Team mode is off, decision 4), the redirect pages for retired ids, and the 404 page. |

## Site

| File | What it is |
|---|---|
| `/sitemap.xml` | All 97 indexable pages (every page except `/team/`). `lastmod` comes from review dates where present. |
| `/robots.txt` | Allows all, and points to the sitemap. |
| `/404.html` | "Page not found". It offers a search that hands off to the site search (`/?q=…`), the closest pages to the mistyped address, and quick links. A retired id typed without the trailing slash (`/rag-math`) goes straight to its page. GitHub Pages and Cloudflare both serve it for unknown paths. |
| `/?q=term` | Opens the site search with the term. This is the target of the `SearchAction`, through the `srOpen` handoff in `scripts/runtime-patches.ts` and `src/scripts/boot.ts`. |

## Share images

`scripts/build-og.mjs` renders one 1200×630 JPEG per page into `public/og/<id>.jpg` at build time. They're gitignored, about 55 KB each.

- **Layout:** nav-group label, page title, site name and tagline, and the AI Atlas emblem on a navy background that matches the logo.
- **How:** satori (layout to SVG) and resvg (SVG to PNG) with the self-hosted Inter font, then sharp (to JPEG).

## Content in the HTML

Since Phase 3, every page's HTML includes its fully rendered content (`scripts/snapshot.mjs`, decision Q1). Text that 46 pages used to draw only with JavaScript is now visible to crawlers. Links the runtime draws as `#page` are real URLs in that HTML.

## Setting the domain

Set `PUBLIC_SITE_URL` (for example `https://atlas.example.com`) when building. On GitHub Pages the workflow uses `https://<owner>.github.io`, or `PAGES_SITE_URL` with a custom domain.

## Tests

| What | File |
|---|---|
| Titles, descriptions (40–155 characters), canonical, OG/Twitter, noindex, JSON-LD and `dateModified` on all 103 pages; image size; sitemap; robots; `?q=`; the 404 page | `tests/e2e/seo.spec.ts` |
| The same with the `/aiatlas/` base path | `tests/e2e/gh-pages.spec.ts` |
