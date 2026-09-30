import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Sign in button has an accessible role and name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signIn = page.getByRole('button', { name: 'Sign in' });
    await expect(signIn).toHaveRole('button');
    await expect(signIn).toHaveAccessibleName('Sign in');
  });

  test('Email field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const email = page.getByLabel('Email');
    await expect(email).toBeVisible();
    await email.focus();
    await expect(email).toBeFocused();
  });

  test('Password field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const password = page.getByLabel('Password');
    await expect(password).toBeVisible();
    await password.focus();
    await expect(password).toBeFocused();
  });

  test('Page has exactly one main heading', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});