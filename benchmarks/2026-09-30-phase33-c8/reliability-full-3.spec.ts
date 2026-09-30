import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('login page still works when email input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[name="email"]')).toBeDisabled();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when password input is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeDisabled();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when Sign in button is disabled', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').toBeDisabled());
    await expect(pageErrors).toEqual([]);
  });
});