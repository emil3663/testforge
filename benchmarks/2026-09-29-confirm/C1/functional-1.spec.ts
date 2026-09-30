import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should accept input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('test@example.com');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('password123');

    // Expect the email and password fields to have the correct values
    await expect(page.getByPlaceholder('Email')).toHaveValue('test@example.com');
    await expect(page.getByPlaceholder('Password')).toHaveValue('password123');
  });

  test('should submit the form when Sign in button is clicked', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('test@example.com');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('password123');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Expect the URL to change to the notes page after successful sign-in
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});