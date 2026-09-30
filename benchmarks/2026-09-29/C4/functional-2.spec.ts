import { test, expect } from '@playwright/test';

// Test the sign-in page
test.describe('Sign-in Page', () => {
  // Test that the sign-in page loads correctly
  test('should load the sign-in page', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    expect(page).toHaveURL('http://127.0.0.1:4410/login');
    expect(page).toHaveTitle('Sign in - Acme Notes');
  });

  // Test that the email and password fields are visible and accept input
  test('should have email and password fields', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    const passwordInput = page.getByRole('textbox', { name: 'Password' });

    expect(emailInput).toBeVisible();
    expect(passwordInput).toBeVisible();

    // Test that the email and password fields accept input
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  // Test that the Sign in button submits the form
  test('should submit the form', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    const signInButton = page.getByRole('button', { name: 'Sign in' });

    // Fill in the email and password fields
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    // Click the Sign in button
    await signInButton.click();

    // Verify that the user is redirected to the notes page
    expect(page).toHaveURL('http://127.0.0.1:4410/notes');
  });
});