import { defineConfig, devices } from '@playwright/test';

// `dist/` is the default build (AI off). `dist-ai/` is built with PUBLIC_AI_ENABLED=true
// (`npm run build:ai-test`) and tested against a mocked /api/claude.
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
  ],
  projects: [
    { name: 'chromium', testIgnore: /ai\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' } },
    { name: 'ai', testMatch: /ai\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' } },
  ],
});
