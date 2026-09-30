import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should display the sign-in page with email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Verify the page title
    await expect(page).toHaveTitle('Sign in - Acme Notes');

    // Verify the email and password fields are visible
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should allow input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill in the email and password fields
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    // Verify the input values
    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('password123');
  });

  test('should submit the sign-in form when the Sign in button is clicked', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill in the email and password fields
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    // Click the Sign in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await signInButton.click();

    // Verify the page navigates to the notes page
    await expect(page).toHaveURL('/notes');
  });
});