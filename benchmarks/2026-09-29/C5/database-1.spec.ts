import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('a new note is still shown after reloading the page', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()}`;
    
    // Navigate to the notes page and fill in a note
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill(uniqueNote);
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note is visible on the page after submission
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Reload the page to simulate a browser refresh or server restart
    await page.reload();
    
    // Verify the note persists after reload - this confirms database persistence
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });

  test('a new note with special characters is still shown after reloading', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()}!@#`;
    
    // Navigate to the notes page and fill in a note with special characters
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill(uniqueNote);
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note is visible on the page after submission
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Reload the page to simulate a browser refresh or server restart
    await page.reload();
    
    // Verify the note persists after reload - this confirms database persistence
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });

  test('a new note is still shown after navigating away and back', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()}`;
    
    // Navigate to the notes page and fill in a note
    await page.goto('http://127.0.0.1:4410/notes');
    await page.getByLabel('Note').fill(uniqueNote);
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note is visible on the page after submission
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Navigate away to simulate user leaving and returning
    await page.goto('http://127.0.0.1:4410/');
    await page.getByLabel('Go to your notes').click();
    
    // Verify the note persists after navigation - this confirms database persistence
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });
});