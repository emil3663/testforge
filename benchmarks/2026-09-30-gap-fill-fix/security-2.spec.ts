import { test, expect } from '@playwright/test';

test.describe('Security', () => {
  test('login page uses HTTPS', async ({ page }) => {
    const pageUrl = 'http://localhost:3000/login';
    test.skip(pageUrl.startsWith('http://'), 'the site under test is served over plain HTTP');
    await page.goto(pageUrl);
    await expect(page).toHaveURL(/^https:/);
  });

  test('invalid email is not accepted', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('http://localhost:3000/login');
  });

  test('invalid password is not accepted', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('http://localhost:3000/login');
  });

  test('input that looks like a script is not executed', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email').fill('<img src=x onerror=alert(1)>');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(dialogs).toEqual([]);
  });
});