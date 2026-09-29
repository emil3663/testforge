import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should accept email and password input', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('test@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('password123');

    // Check that the email and password fields are filled correctly
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

    // Check that the form submission was successful
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });

  test('should display an error message for invalid credentials', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email field with invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');

    // Fill in the password field with invalid credentials
    await page.getByLabel('Password').fill('wrongpassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Check that an error message is displayed
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});