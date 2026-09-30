import { test, expect } from '@playwright/test';

test.describe('SEO/Content', () => {
  test('login page has a title', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page).toHaveTitle(/.+/);
  });

  test('login page has a meta description', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('login page has exactly one main heading', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('login page has email and password fields', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('login page has Sign in button', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});