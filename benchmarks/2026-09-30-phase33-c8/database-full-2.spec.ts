import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('a new contact message is still shown after reloading the page', async ({ page }) => {
    const name = `TestForge check ${Date.now()}`;
    const message = `Hello, this is a test message ${Date.now()}`;

    await page.goto('http://localhost:3000/contact');

    // Fill out the contact form
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Message').fill(message);

    // Submit the form
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify the message is visible on the page
    await expect(page.getByText(message)).toBeVisible();

    // Reload the page
    await page.reload();

    // Verify the message is still visible after reload
    await expect(page.getByText(message)).toBeVisible();
  });
});