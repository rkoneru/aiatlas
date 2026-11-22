import { defineConfig, devices } from '@playwright/test';

// `dist/` is the default build (AI off). `dist-ai/` is built with PUBLIC_AI_ENABLED=true
// (`npm run build:ai-test`) and tested against a mocked /api/claude. `dist-gh/` is built for
// GitHub Pages under /aiatlas/ (`npm run build:gh-test`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'off' },
  webServer: [
    { command: 'node tests/static-server.mjs dist 4321', port: 4321, reuseExistingServer: true },
    { command: 'node tests/static-server.mjs dist-ai 4322', port: 4322, reuseExistingServer: true },
    { command: 'node tests/static-server.mjs dist-gh 4323 /aiatlas/', port: 4323, reuseExistingServer: true },
  ],
  projects: [
    { name: 'chromium', testIgnore: /(ai|gh-pages)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' } },
    { name: 'ai', testMatch: /\/ai\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' } },
    { name: 'gh-pages', testMatch: /(gh-pages|pages)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4323/aiatlas/' } },
  ],
});
