import { test } from '@playwright/test';

// Keep startup failures visible in CI even when the login form never mounts.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error(`[browser startup] ${error.message}`));
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    console.error(`[browser request] ${url.origin}${url.pathname}: ${request.failure()?.errorText}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    console.error(`[browser failure] ${(await page.locator('body').innerText()).slice(0, 2000)}`);
  }
});
