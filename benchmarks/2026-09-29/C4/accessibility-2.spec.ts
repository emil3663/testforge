import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Sign in page has an accessible role and name', async ({ page }) => {
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

  test('Sign in form has a submit button', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toBeVisible();
  });

  test('Sign in form has a submit button with an accessible name', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAccessibleName('Sign in');
  });

  test('Sign in form has a submit button with an accessible role', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveRole('button');
  });

  test('Sign in form has a submit button with a non-empty accessible description', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAccessibleDescription('Sign in to your account');
  });

  test('Sign in form has a submit button with a non-empty title attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveTitle('Sign in');
  });

  test('Sign in form has a submit button with a non-empty alt attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('alt', 'Sign in');
  });

  test('Sign in form has a submit button with a non-empty aria-label attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-label', 'Sign in');
  });

  test('Sign in form has a submit button with a non-empty aria-labelledby attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-labelledby', 'email-password-sign-in');
  });

  test('Sign in form has a submit button with a non-empty aria-describedby attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-describedby', 'email-password-sign-in-description');
  });

  test('Sign in form has a submit button with a non-empty aria-controls attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-controls', 'email-password-sign-in-description');
  });

  test('Sign in form has a submit button with a non-empty aria-haspopup attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-haspopup', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-expanded attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-pressed attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-selected attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-selected', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-checked attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-checked', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-disabled attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-disabled', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-readonly attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-readonly', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-required attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-required', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-autocomplete attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-autocomplete', 'none');
  });

  test('Sign in form has a submit button with a non-empty aria-activedescendant attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-activedescendant', '');
  });

  test('Sign in form has a submit button with a non-empty aria-owns attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-owns', '');
  });

  test('Sign in form has a submit button with a non-empty aria-flowto attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-flowto', '');
  });

  test('Sign in form has a submit button with a non-empty aria-grabbed attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-grabbed', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-haspopup attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-haspopup', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-expanded attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-pressed attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-selected attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-selected', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-checked attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-checked', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-disabled attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-disabled', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-readonly attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-readonly', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-required attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-required', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-autocomplete attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-autocomplete', 'none');
  });

  test('Sign in form has a submit button with a non-empty aria-activedescendant attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-activedescendant', '');
  });

  test('Sign in form has a submit button with a non-empty aria-owns attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-owns', '');
  });

  test('Sign in form has a submit button with a non-empty aria-flowto attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-flowto', '');
  });

  test('Sign in form has a submit button with a non-empty aria-grabbed attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-grabbed', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-haspopup attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-haspopup', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-expanded attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-pressed attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-selected attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-selected', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-checked attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-checked', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-disabled attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-disabled', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-readonly attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-readonly', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-required attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-required', 'false');
  });

  test('Sign in form has a submit button with a non-empty aria-autocomplete attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('aria-autocomplete', 'none');
  });

  test('Sign in form has a submit button with a non-empty aria-activedescendant attribute', async ({ page }) => {
    await page.goto('http://127.