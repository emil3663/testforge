import { test, expect } from '@playwright/test';

test.describe('Database', () => {
  test('a new note is persisted after reloading the page', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()}`;
    
    // Navigate to the notes page where the form exists
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Fill in the note field with a unique value
    await page.getByLabel('Note').fill(uniqueNote);
    
    // Submit the form to save the note
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note was created and is visible on the page
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Reload the page to simulate a new browser session or refresh
    await page.reload();
    
    // Verify the note persists after reload (proves database persistence)
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });

  test('a note with special characters is persisted correctly', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()} - Special chars: @#$%^&*()!";`;
    
    // Navigate to the notes page
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Fill in the note field with special characters
    await page.getByLabel('Note').fill(uniqueNote);
    
    // Submit the form to save the note
    await page.getByRole('button', { name: 'Save note' }).click();
    
    // Verify the note was created and is visible on the page
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Reload the page to simulate a new browser session or refresh
    await page.reload();
    
    // Verify the note persists after reload (proves database persistence)
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });

  test('a note is persisted when using keyboard navigation', async ({ page }) => {
    const uniqueNote = `TestForge check ${Date.now()}`;
    
    // Navigate to the notes page
    await page.goto('http://127.0.0.1:4410/notes');
    
    // Focus on the note field using keyboard navigation
    await page.getByLabel('Note').focus();
    
    // Type the unique note value
    await page.keyboard.type(uniqueNote);
    
    // Submit the form using Enter key (keyboard navigation)
    await page.press('input[name="note"]', 'Enter');
    
    // Verify the note was created and is visible on the page
    await expect(page.getByText(uniqueNote)).toBeVisible();
    
    // Reload the page to simulate a new browser session or refresh
    await page.reload();
    
    // Verify the note persists after reload (proves database persistence)
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });
});