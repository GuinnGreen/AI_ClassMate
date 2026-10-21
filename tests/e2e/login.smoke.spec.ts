import { expect, test } from '@playwright/test';
import './diagnostics';

test('login and registration surfaces render without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ClassMate AI' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-app-environment', 'development');
  await expect(page.locator('html')).toHaveAttribute('data-firebase-emulators', 'true');
  await expect(page.getByText('DEVELOPMENT · FIREBASE EMULATOR')).toBeVisible();
  expect(requests.filter(url => /ClassroomApp|StudentDetailWorkspace|spreadsheetWriter|firebase_firestore/.test(url))).toEqual([]);
  const faviconUrl = await page.locator('link[rel="icon"]').getAttribute('href');
  const favicon = await page.request.get(faviconUrl!);
  expect(favicon.ok()).toBeTruthy();
  expect(await favicon.text()).toContain('<svg');

  await page.getByRole('button', { name: /註冊/ }).click();
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('mobile login page has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ClassMate AI' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-firebase-emulators', 'true');
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
