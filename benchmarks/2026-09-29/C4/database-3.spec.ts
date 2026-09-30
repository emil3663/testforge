import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('a new note is still shown after reloading the page', async ({ page }) => {
    const noteValue = `TestForge check ${Date.now()}`;
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill(noteValue);
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page.getByText(noteValue)).toBeVisible();
    await page.reload();
    await expect(page.getByText(noteValue)).toBeVisible();
  });
});