import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should navigate to the sign-in page', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Verify the page title
    await expect(page).toHaveTitle('Sign in - Acme Notes');

    // Verify the sign-in form is visible
    await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  });

  test('should accept email and password input', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill the email field
    await page.getByLabel('Email').fill('test@example.com');

    // Fill the password field
    await page.getByLabel('Password').fill('password123');

    // Verify the input values
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('password123');
  });

  test('should submit the sign-in form', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill the email field
    await page.getByLabel('Email').fill('test@example.com');

    // Fill the password field
    await page.getByLabel('Password').fill('password123');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify navigation to the notes page
    await expect(page).toHaveURL('/notes');
  });
});