import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    // Exercise real split chunks and asset URLs, with isolated emulator config.
    command: 'npm run build -- --mode test && npm run preview -- --host localhost --port 3000',
    url: 'http://localhost:3000',
    // An arbitrary local server cannot prove it serves the isolated test build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
