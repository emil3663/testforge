import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Sign in page has an accessible role and name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Email field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible();
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
  });

  test('Password field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toBeVisible();
    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();
  });

  test('Sign in button is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeVisible();
    await signInButton.focus();
    await expect(signInButton).toBeFocused();
  });

  test('Sign in form has an accessible role and name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveAccessibleDescription('Sign in to your account');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible role for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveRole('textbox');
  });

  test('Sign in form has an accessible role for sign in button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toHaveRole('button');
  });

  test('Sign in form has an accessible label for email field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAccessibleName('Email');
  });

  test('Sign in form has an accessible label for password field', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible label for sign in button', async ({ page }) => {
    await page.goto('http://