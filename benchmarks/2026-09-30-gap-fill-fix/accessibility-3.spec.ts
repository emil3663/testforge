import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Login page is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check email field
    const email = page.getByLabel('Email');
    await expect(email).toBeVisible();
    await email.focus();
    await expect(email).toBeFocused();

    // Check password field
    const password = page.getByLabel('Password');
    await expect(password).toBeVisible();
    await password.focus();
    await expect(password).toBeFocused();

    // Check Sign in button
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeVisible();
    await signInButton.focus();
    await expect(signInButton).toBeFocused();
  });
});