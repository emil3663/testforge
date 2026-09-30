import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('login page still works when its API requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when third-party requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const ownHost = new URL('http://localhost:3000/login').host;
    await page.route((url) => url.host !== ownHost, (route) => route.abort('failed'));
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when localStorage is unavailable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new Error('localStorage disabled by the test'); },
      });
    });
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});