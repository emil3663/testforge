import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('page still works when its API requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/status', (route) => route.abort('failed'));
    const response = await page.goto('http://127.0.0.1:4410/');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when third-party requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const ownHost = new URL('http://127.0.0.1:4410/').host;
    await page.route((url) => url.host !== ownHost, (route) => route.abort('failed'));
    const response = await page.goto('http://127.0.0.1:4410/');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when localStorage is unavailable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new Error('localStorage disabled by the test'); },
      });
    });
    const response = await page.goto('http://127.0.0.1:4410/');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});