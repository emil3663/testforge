import { test, expect } from '@playwright/test';

test.describe('SEO/Content', () => {
  // Test home page SEO content
  test('home page has correct title', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page).toHaveTitle('Home - Acme Notes');
  });

  test('home page has meta description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Home: keep short notes with Acme Notes.');
  });

  test('home page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acme Notes');
  });

  // Test login page SEO content
  test('login page has correct title', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page).toHaveTitle('Sign in - Acme Notes');
  });

  test('login page has meta description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Sign in: keep short notes with Acme Notes.');
  });

  test('login page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
  });

  // Test notes page SEO content
  test('notes page has correct title', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/notes');
    await expect(page).toHaveTitle('Notes - Acme Notes');
  });

  test('notes page has meta description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/notes');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Notes: keep short notes with Acme Notes.');
  });

  test('notes page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/notes');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notes');
  });
});