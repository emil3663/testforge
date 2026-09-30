import { test, expect } from '@playwright/test';

test.describe('Sign-in Page Functional Tests', () => {
  test('should navigate to the sign-in page', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Click the "Sign in" link to go to the sign-in page
    await page.getByText('Sign in').click();

    // Verify that the sign-in page is displayed
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('should accept input in email and password fields', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill in the email and password fields
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Verify that the input values are correct
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('password123');
  });

  test('should submit the sign-in form', async ({ page }) => {
    // Navigate to the sign-in page
    await page.goto('/login');

    // Fill in the email and password fields
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Click the "Sign in" button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify that the form is submitted (this is a placeholder, replace with actual verification)
    await expect(page).toHaveURL('/notes'); // Assuming successful login redirects to notes page
  });
});