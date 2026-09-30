import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('login page still works when email input is blocked', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/email-input', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').textContent()).toBe('Sign in');
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when password input is blocked', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/password-input', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').textContent()).toBe('Sign in');
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when Sign in button is blocked', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/sign-in-button', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').textContent()).toBe('Sign in');
    await expect(pageErrors).toEqual([]);
  });
});