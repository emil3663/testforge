import { test, expect } from '@playwright/test';

test.describe('SEO/Content', () => {
  test('home page has a title', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page).toHaveTitle('Home - Acme Notes');
  });

  test('home page has a meta description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Home: keep short notes with Acme Notes.');
  });

  test('home page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acme Notes');
  });
});