# Decisions

## From the brief (fixed)

1. Astro, static output, TypeScript for new code. Cloudflare Pages, portable to Vercel/Netlify.
2. One URL per page, using the section ids: `/rag/`, `/mcp/` and so on. `/` is `overview`.
3. AI features off at launch: `PUBLIC_AI_ENABLED=false`. When the flag is on, they call the site's own `/api/claude` proxy.
4. Team mode is out of the nav and the sitemap. The code stays, and `db`/`user` report unavailable.
5. Voice-over uses `speechSynthesis`.
6. Downloads use a Blob and `<a download>`.
7. Analytics: Plausible, behind `PUBLIC_PLAUSIBLE_DOMAIN`.
8. Content licence CC BY-NC 4.0, code licence MIT.

## After Phase 0 (answered "go with recommendations")

| # | Question | Decision | Phase |
|---|---|---|---|
| Q1 | Pages whose text is mostly drawn by JS (46 of 98) | Build-time snapshot: put the rendered section HTML in the page, keep the original in a `<template>`, and restore it before the runtime starts. | 4 |
| Q2 | `/` auto-jumped to the last page | `/` stays the home page and shows "Continue where you left off". | 1 (done) |
| Q3 | Google Fonts `<link>` inside downloaded HTML exports | Remove it; exports fall back to system fonts. | 2 |
| Q4 | Copy that says "Open the Atlas on claude.ai…" | Replace the strings visitors see (AI-off notices, download fallbacks, voice tooltip) with neutral wording. Leave page content. | 2 |
