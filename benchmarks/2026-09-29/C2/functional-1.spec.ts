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

  test('should submit the sign-in form with valid credentials', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email and password fields
    await page.getByLabel('Email').fill('example@example.com');
    await page.getByLabel('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the navigation to the notes page is successful
    await expect(page).toHaveURL('http://127.0.0.1:4410/notes');

    // Verify the presence of the notes page elements
    await expect(page.getByRole('main')).toHaveRole('main');
    await expect(page.getByRole('button', { name: 'Save note' })).toBeVisible();
  });

  test('should display an error message for invalid credentials', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('http://127.0.0.1:4410/login');

    // Fill in the email and password fields with invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('invalidPassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify the presence of an error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});