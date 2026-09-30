import { test, expect } from '@playwright/test';

// Test the sign-in page for functional coverage
test.describe('Sign-in Page Functional Tests', () => {
  test('Visits the sign-in page', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');
    // Verify the page URL matches the expected URL
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');
    // Verify the page title matches the expected title
    await expect(page).toHaveTitle('Sign in - Acme Notes');
  });

  test('Email and password fields are visible', async ({ page }) => {
    // Locate the email input field
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    // Verify the email input field is visible
    await expect(emailInput).toBeVisible();
    // Locate the password input field
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    // Verify the password input field is visible
    await expect(passwordInput).toBeVisible();
  });

  test('Sign in button is visible', async ({ page }) => {
    // Locate the sign-in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    // Verify the sign-in button is visible
    await expect(signInButton).toBeVisible();
  });

  test('Sign in button submits the form', async ({ page }) => {
    // Locate the email input field
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    // Locate the password input field
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    // Locate the sign-in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });

    // Fill in the email and password fields
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    // Click the sign-in button
    await signInButton.click();

    // Verify the page URL changes to the notes page
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});