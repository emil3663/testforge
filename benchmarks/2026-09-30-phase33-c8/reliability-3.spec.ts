import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('page still works when email input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('input[name="email"]').isDisabled()).toBe(true);
    await expect(page.locator('input[name="password"]').isDisabled()).toBe(false);
    await expect(page.locator('button[type="submit"]').isDisabled()).toBe(true);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when password input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('input[name="email"]').isDisabled()).toBe(false);
    await expect(page.locator('input[name="password"]').isDisabled()).toBe(true);
    await expect(page.locator('button[type="submit"]').isDisabled()).toBe(true);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when sign in button is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('input[name="email"]').isDisabled()).toBe(false);
    await expect(page.locator('input[name="password"]').isDisabled()).toBe(false);
    await expect(page.locator('button[type="submit"]').isDisabled()).toBe(true);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});