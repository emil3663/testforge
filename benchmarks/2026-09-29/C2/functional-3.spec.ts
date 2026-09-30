import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Testing', () => {
  test('should accept email and password input', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('test@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('password123');

    // Expect both fields to have the correct values
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('password123');
  });

  test('should submit the sign-in form', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('test@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('password123');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Expect the URL to change to the notes page
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});