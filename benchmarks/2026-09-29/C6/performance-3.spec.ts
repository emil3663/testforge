import { test, expect } from '@playwright/test';

test.describe('Performance/Load', () => {
  test('page finishes loading within 3 seconds', async ({ page }) => {
    await page.goto('/');
    const start = Date.now();
    await page.waitForLoadState('networkidle');
    await expect(Date.now() - start).toBeLessThan(3000);
  });

  test('server responds and the page is ready quickly', async ({ page }) => {
    await page.goto('/');
    const timing = await page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return { firstByte: navigation.responseStart, domReady: navigation.domContentLoadedEventEnd };
    });
    await expect(timing.firstByte).toBeLessThan(800);
    await expect(timing.domReady).toBeLessThan(2000);
  });

  test('login page finishes loading within 3 seconds', async ({ page }) => {
    await page.goto('/login');
    const start = Date.now();
    await page.waitForLoadState('networkidle');
    await expect(Date.now() - start).toBeLessThan(3000);
  });

  test('notes page finishes loading within 3 seconds', async ({ page }) => {
    await page.goto('/notes');
    const start = Date.now();
    await page.waitForLoadState('networkidle');
    await expect(Date.now() - start).toBeLessThan(3000);
  });
});