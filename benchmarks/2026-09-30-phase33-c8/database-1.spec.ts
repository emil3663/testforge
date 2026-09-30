import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('contact form submission persists data', async ({ page }) => {
    const name = `TestForge check ${Date.now()}`;
    const message = `Message ${Date.now()}`;

    await page.goto('http://localhost:3000/contact');

    // Fill out the form
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Message').fill(message);

    // Submit the form
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify the form submission
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();

    // Reload the page to check persistence
    await page.reload();

    // Verify the data persists after reload
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
});