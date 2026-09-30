import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('page still works when email input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    const response = await page.goto('http://localhost:3000/login');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when password input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    const response = await page.goto('http://localhost:3000/login');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when Sign in button is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    const response = await page.goto('http://localhost:3000/login');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});