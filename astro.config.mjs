// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://example.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // The runtime is shipped as-is: its exporters serialize their own source (see docs/inventory-findings.md B8).
  vite: { build: { assetsInlineLimit: 0 } },
});
