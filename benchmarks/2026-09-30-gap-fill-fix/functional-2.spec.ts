import { test, expect } from '@playwright/test';

test.describe('Login Page Functional Testing', () => {
  test('Email and password fields accept input and Sign in button submits the form', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login');

    // Fill in the email field
    await page.getByLabel('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByLabel('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form submission was successful
    await expect(page).toHaveURL('http://localhost:3000/dashboard'); // Assuming the dashboard is the expected next page after login
  });
});