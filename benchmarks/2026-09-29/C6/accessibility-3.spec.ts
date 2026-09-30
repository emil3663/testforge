import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Sign in button has an accessible role and name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Email field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailField = page.getByLabel('Email');
    await expect(emailField).toBeVisible();
    await emailField.focus();
    await expect(emailField).toBeFocused();
  });

  test('Password field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordField = page.getByLabel('Password');
    await expect(passwordField).toBeVisible();
    await passwordField.focus();
    await expect(passwordField).toBeFocused();
  });

  test('Sign in button is reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeVisible();
    await signInButton.focus();
    await expect(signInButton).toBeFocused();
  });
});