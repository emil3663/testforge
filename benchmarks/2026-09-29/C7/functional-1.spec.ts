import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should accept input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');

    // Fill in the password field
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');

    // Verify that the email and password fields are filled
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('test@example.com');
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue('password123');
  });

  test('should submit the form when Sign in button is clicked', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');

    // Fill in the password field
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form is submitted (e.g., navigate to the notes page)
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});