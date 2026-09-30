import { test, expect } from '@playwright/test';

test.describe('Security', () => {
  test('notes page form fields do not accept invalid input', async ({ page }) => {
    const pageUrl = 'http://127.0.0.1:4410/notes';
    await page.goto(pageUrl);

    // Test invalid input in the Note field
    await page.getByLabel('Note').fill('This is a test note');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');

    // Test input that looks like a script
    await page.getByLabel('Note').fill('<script>alert("XSS")</script>');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});