import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('contact page form submits successfully and data persists', async ({ page }) => {
    const name = `TestForge check ${Date.now()}`;
    const message = `Message ${Date.now()}`;

    // Navigate to the contact page
    await page.goto('http://localhost:3000/contact');

    // Fill out the form
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Message').fill(message);

    // Submit the form
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify form submission
    await expect(page.getByText('Thank you for your message!')).toBeVisible();

    // Reload the page to check if data persists
    await page.reload();

    // Verify data persists
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await expect(page.getByLabel('Message')).toHaveValue(message);
    await expect(page.getByText(message)).toBeVisible();
  });
});