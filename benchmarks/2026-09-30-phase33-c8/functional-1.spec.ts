import { test, expect } from '@playwright/test';

test.describe('Login Page Functional Testing', () => {
  test('should accept email and password input and submit the form', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('example@example.com');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form submission was successful
    await expect(page).toHaveURL('http://localhost:3000/dashboard'); // Assuming successful login redirects to dashboard
  });

  test('should handle invalid email input', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field with an invalid email
    await page.getByPlaceholder('Email').fill('invalid-email');

    // Fill in the password field
    await page.getByPlaceholder('Password').fill('examplePassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form submission fails
    await expect(page).toHaveURL('http://localhost:3000/login'); // Assuming invalid login redirects back to login page
  });

  test('should handle invalid password input', async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000');

    // Fill in the email field
    await page.getByPlaceholder('Email').fill('example@example.com');

    // Fill in the password field with an invalid password
    await page.getByPlaceholder('Password').fill('invalidPassword');

    // Click the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form submission fails
    await expect(page).toHaveURL('http://localhost:3000/login'); // Assuming invalid login redirects back to login page
  });
});