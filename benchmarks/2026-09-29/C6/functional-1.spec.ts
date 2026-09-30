import { test, expect } from '@playwright/test';

test.describe('Functional', () => {
  test('Sign-in page: email and password fields accept input', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    const emailInput = await page.getByPlaceholder('Email');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    const passwordInput = await page.getByPlaceholder('Password');
    await passwordInput.fill('password');
    await expect(passwordInput).toHaveValue('password');
  });

  test('Sign-in page: Sign in button submits the form', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    const signInButton = await page.getByRole('button', { name: 'Sign in' });
    await signInButton.click();
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');
  });
});