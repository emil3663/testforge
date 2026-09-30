import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Testing', () => {
  test('should accept input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Enter email and password
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Verify input is accepted
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('password123');
  });

  test('should submit the form with valid credentials', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Enter email and password
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify navigation to notes page
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Enter invalid email and password
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify error message is shown
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});