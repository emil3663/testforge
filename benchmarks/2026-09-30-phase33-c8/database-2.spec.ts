import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('contact form submission persists data', async ({ page }) => {
    const name = `TestForge check ${Date.now()}`;
    const message = `Test message ${Date.now()}`;

    await page.goto('http://localhost:3000/contact');

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Message').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
});