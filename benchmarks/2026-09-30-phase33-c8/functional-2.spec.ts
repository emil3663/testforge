import { test, expect } from '@playwright/test';

test.describe('Login Page Functional Testing', () => {
  test('should accept input in email and password fields', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByLabel('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('examplePassword');

    // Expect both fields to be filled
    await expect(page.getByLabel('Email')).toHaveValue('example@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('examplePassword');
  });

  test('should submit the form when Sign in button is clicked', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByLabel('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Expect the URL to change after submission (this is a placeholder URL)
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });
});