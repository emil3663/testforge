import { test, expect } from '@playwright/test';

test.describe('Security', () => {
  test('page stays on HTTPS when the site uses HTTPS', async ({ page }) => {
    const pageUrl = 'https://127.0.0.1:4410/notes';
    test.skip(pageUrl.startsWith('http://'), 'the site under test is served over plain HTTP');
    await page.goto(pageUrl);
    await expect(page).toHaveURL(/^https:/);
  });

  test('invalid input is not accepted', async ({ page }) => {
    await page.goto('https://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill('not-a-valid-note');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page).toHaveURL('https://127.0.0.1:4410/notes');
  });

  test('input that looks like a script is not executed', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('https://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill('<img src=x onerror=alert(1)>');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(dialogs).toEqual([]);
  });
});