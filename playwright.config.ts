import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  webServer: { command: `node tests/static-server.mjs dist ${PORT}`, port: PORT, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
