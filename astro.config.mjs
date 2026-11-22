// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://example.com',
  // Base path: '/' on Cloudflare/custom domain, '/<repo>/' on GitHub Pages project sites.
  base: process.env.ATLAS_BASE || '/',
  output: 'static',
  outDir: process.env.ATLAS_OUT_DIR || './dist',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // The runtime is shipped as-is: its exporters serialize their own source (see docs/inventory-findings.md B8).
  vite: { build: { assetsInlineLimit: 0 } },
});
