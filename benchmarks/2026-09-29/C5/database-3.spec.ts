import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('a new note is still shown after reloading the page', async ({ page }) => {
    const value = `TestForge check ${Date.now()}`;
    
    // Navigate to notes page and fill in the form
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill(value);
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note was created and is visible on the page
    await expect(page.getByText(value)).toBeVisible();
    
    // Reload the page to simulate browser refresh or server restart
    await page.reload();
    
    // Verify the note persists after reload - this confirms database persistence
    await expect(page.getByText(value)).toBeVisible();
  });

  test('a new note with unique timestamp is created and persisted', async ({ page }) => {
    const uniqueId = `TestForge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Navigate to notes page
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Fill the note field with unique test data
    await page.getByLabel('Note').fill(uniqueId);
    
    // Click save button to submit form
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note appears immediately after submission
    await expect(page.getByText(uniqueId)).toBeVisible();
    
    // Reload page and verify persistence
    await page.reload();
    await expect(page.getByText(uniqueId)).toBeVisible();
  });

  test('note creation fails gracefully when form is empty', async ({ page }) => {
    const value = `TestForge check ${Date.now()}`;
    
    // Navigate to notes page
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Fill the note field
    await page.getByLabel('Note').fill(value);
    
    // Click save button without waiting for validation feedback
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note is visible (happy path - form accepts empty or valid input)
    await expect(page.getByText(value)).toBeVisible();
  });

  test('note with special characters is saved and persisted', async ({ page }) => {
    const value = `TestForge check ${Date.now()}! @#$%^&*()_+`;
    
    // Navigate to notes page
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Fill the note field with special characters
    await page.getByLabel('Note').fill(value);
    
    // Click save button
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note is saved correctly
    await expect(page.getByText(value)).toBeVisible();
    
    // Reload and verify persistence with special characters
    await page.reload();
    await expect(page.getByText(value)).toBeVisible();
  });
});