import { test, expect } from '@playwright/test';

test.describe('Functional', () => {
  test('Sign-in page: email and password fields accept input', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    const emailLocator = page.getByPlaceholder('Email');
    await emailLocator.fill('test@example.com');
    await expect(emailLocator).toHaveValue('test@example.com');

    const passwordLocator = page.getByPlaceholder('Password');
    await passwordLocator.fill('password');
    await expect(passwordLocator).toHaveValue('password');
  });

  test('Sign-in page: Sign in button submits the form', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    const submitButtonLocator = page.getByRole('button', { name: 'Sign in' });
    await submitButtonLocator.click();
    await expect(page).not.toHaveURL('http://127.0.0.1:4410/login');
  });
});