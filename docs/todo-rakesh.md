# TODO(Rakesh)

Items that need your input. Search the code for `TODO(Rakesh)` to find each one.

| What | Where |
|---|---|
| Contact email address. It's used by the footer, the About page's "tell Rakesh directly" link, Privacy and Terms. Set `contactEmail` (or the `PUBLIC_CONTACT_EMAIL` env var). | `src/data/site.json` |
| Review the **Privacy** draft. Name the hosting provider, and confirm the analytics and AI statements. | `src/pages/privacy.astro` |
| Review the **Terms** draft. Choose the governing law and jurisdiction. | `src/pages/terms.astro` |
| When both are approved, remove `privacy` and `terms` from `draftPages`. That drops the "Draft" note and `noindex`, and adds them to the sitemap. | `src/data/site.json` |
| Plausible: set `PUBLIC_PLAUSIBLE_DOMAIN` in the host's environment, if you want analytics. | host settings |
| Site name: the new logo says "AI Atlas", the site still says "AI Architecture Atlas". | `src/lib/seo.ts` (`SITE_NAME`), `scripts/build-og.mjs` |
| AI proxy: decide whether and where to turn it on. | `docs/ai-proxy.md` |
