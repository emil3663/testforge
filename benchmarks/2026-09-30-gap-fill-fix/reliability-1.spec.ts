import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('login page still works when email field is missing', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when password field is missing', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await page.getByPlaceholder('Password').fill('example');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('login page still works when API requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('http://localhost:3000');
    await page.getByPlaceholder('Email').fill('example@example.com');
    await page.getByPlaceholder('Password').fill('example');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});