import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should navigate to the sign-in page', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Verify the page title
    await expect(page).toHaveTitle('Sign in - Acme Notes');

    // Verify the page URL
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    // Verify the presence of the email and password fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Verify the presence of the Sign in button
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('should allow input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Input valid email and password
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Verify the input values
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('password123');
  });

  test('should submit the sign-in form', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Input valid email and password
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify the navigation to the notes page
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');

    // Verify the presence of the notes page title
    await expect(page).toHaveTitle('Notes - Acme Notes');
  });

  test('should handle invalid input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Input invalid email and password
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify the form submission failure
    await expect(page).toHaveURL('http://127.0.0.1:4410/login');

    // Verify the presence of error messages (if any)
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});