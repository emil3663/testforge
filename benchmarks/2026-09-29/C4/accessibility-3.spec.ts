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

  test('Sign in form has an accessible role and name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has an accessible description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveAccessibleDescription('Sign in: keep short notes with Acme Notes.');
  });

  test('Sign in form has an accessible name and label', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveAccessibleName('Sign in');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleName('Email');
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleName('Password');
  });

  test('Sign in form has an accessible role and label', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRole('textbox');
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRole('textbox');
  });

  test('Sign in form has an accessible role and placeholder', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessiblePlaceholder('Email');
    await expect(signInForm.getByLabel('Password')).toHaveAccessiblePlaceholder('Password');
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessibleRequired(true);
    await expect(signInForm.getByLabel('Password')).toHaveAccessibleRequired(true);
  });

  test('Sign in form has an accessible role and aria-required', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const signInForm = page.getByRole('form', { name: 'Sign in' });
    await expect(signInForm).toHaveRole('form');
    await expect(signInForm.getByLabel('Email')).toHaveAccessible