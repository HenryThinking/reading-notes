import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: 'sync-real.spec.ts', workers: 1,
  outputDir: '.wrangler/sync-e2e/results',
  globalTeardown: './e2e/sync-teardown.ts',
  timeout: 90_000, reporter: 'list',
  use: {
    baseURL: 'https://127.0.0.1:8789',
    actionTimeout: 15_000, navigationTimeout: 15_000,
    // Only the local Miniflare self-signed certificate, never production.
    ignoreHTTPSErrors: true,
    ...devices['Desktop Chrome'], channel: 'chrome',
    trace: 'off', screenshot: 'off'
  },
  webServer: {
    command: 'npm run build && node scripts/run-sync-e2e.mjs',
    url: 'https://127.0.0.1:8789', ignoreHTTPSErrors: true,
    reuseExistingServer: false, timeout: 120_000
  }
})
