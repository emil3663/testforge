import { test, expect } from '@playwright/test';

// Test the sign-in page
test.describe('Sign-in Page', () => {
  // Navigate to the sign-in page
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
  });

  // Test that the email and password fields are visible and accept input
  test('Email and password fields are visible and accept input', async ({ page }) => {
    // Check that the email field is visible and accepts input
    const emailField = page.getByRole('textbox', { name: 'Email' });
    expect(emailField).toBeVisible();
    await emailField.fill('test@example.com');

    // Check that the password field is visible and accepts input
    const passwordField = page.getByRole('textbox', { name: 'Password' });
    expect(passwordField).toBeVisible();
    await passwordField.fill('password123');
  });

  // Test that the Sign in button submits the form
  test('Sign in button submits the form', async ({ page }) => {
    // Fill in the email and password fields
    const emailField = page.getByRole('textbox', { name: 'Email' });
    await emailField.fill('test@example.com');

    const passwordField = page.getByRole('textbox', { name: 'Password' });
    await passwordField.fill('password123');

    // Click the Sign in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await signInButton.click();

    // Check that the page navigates to the notes page
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});