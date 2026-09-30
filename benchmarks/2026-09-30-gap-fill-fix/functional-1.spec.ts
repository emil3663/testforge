import { test, expect } from '@playwright/test';

test.describe('Login Page Functional Testing', () => {
  test('Email and password fields accept input', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('examplePassword');

    // Verify that the email and password fields are filled
    await expect(page.getByLabel('Email')).toHaveValue('example@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('examplePassword');
  });

  test('Sign in button submits the form', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form is submitted (e.g., navigate to a new page)
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });
});