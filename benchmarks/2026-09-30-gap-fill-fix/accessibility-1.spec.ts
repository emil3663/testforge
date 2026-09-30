import { test, expect } from '@playwright/test';

test.describe('Login Page Accessibility', () => {
  test('Email and password fields and Sign in button are accessible', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check email field
    const emailField = page.getByLabel('Email');
    await expect(emailField).toBeVisible();
    await emailField.focus();
    await expect(emailField).toBeFocused();

    // Check password field
    const passwordField = page.getByLabel('Password');
    await expect(passwordField).toBeVisible();
    await passwordField.focus();
    await expect(passwordField).toBeFocused();

    // Check Sign in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeVisible();
    await signInButton.focus();
    await expect(signInButton).toBeFocused();
  });
});