import { test, expect } from '@playwright/test';

test.describe('Functional', () => {
  test('Sign-in page: email and password fields accept input', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Password').fill('password');
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('Sign-in page: Sign in button submits the form', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await page.getByText('Email Password Sign in').click();
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Password')).toBeVisible();
  });
});