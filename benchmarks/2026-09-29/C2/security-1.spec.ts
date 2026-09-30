import { test, expect } from '@playwright/test';

test.describe('Security', () => {
  test('invalid input is not accepted', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill('This is a test note');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });

  test('input that looks like a script is not executed', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill('<script>alert("XSS")</script>');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(dialogs).toEqual([]);
  });
});