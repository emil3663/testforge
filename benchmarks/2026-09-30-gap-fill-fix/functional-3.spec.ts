import { test, expect } from '@playwright/test';

test.describe('Login Page Functional Testing', () => {
  test('Email and password fields accept input', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('examplePassword123');

    // Verify that the email and password fields are filled
    await expect(page.getByPlaceholder('Email')).toHaveValue('example@example.com');
    await expect(page.getByPlaceholder('Password')).toHaveValue('examplePassword123');
  });

  test('Sign in button submits the form', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('examplePassword123');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form is submitted (e.g., navigate to a new page)
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });
});