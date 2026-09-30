import { test, expect } from '@playwright/test';

test.describe('SEO/Content', () => {
  test('page has a title', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page).toHaveTitle('Home - Acme Notes');
  });

  test('page has a meta description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Home: keep short notes with Acme Notes.');
  });

  test('page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('page has a heading with the correct text', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home - Acme Notes');
  });

  test('page has a heading with the correct text on the login page', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in - Acme Notes');
  });

  test('page has a heading with the correct text on the notes page', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/notes');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notes - Acme Notes');
  });
});