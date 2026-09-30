import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Email field has an accessible role and name', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const email = page.getByLabel('Email');
    await expect(email).toBeVisible();
    await expect(email).toHaveRole('textbox');
    await expect(email).toHaveAccessibleName('Email');
  });

  test('Password field has an accessible role and name', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const password = page.getByLabel('Password');
    await expect(password).toBeVisible();
    await expect(password).toHaveRole('textbox');
    await expect(password).toHaveAccessibleName('Password');
  });

  test('Sign in button has an accessible role and name', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const signIn = page.getByRole('button', { name: 'Sign in' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveRole('button');
    await expect(signIn).toHaveAccessibleName('Sign in');
  });
});