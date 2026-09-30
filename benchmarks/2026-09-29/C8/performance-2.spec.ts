import { test, expect } from '@playwright/test';

test.describe('Performance/Load', () => {
  test('home page finishes loading within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://127.0.0.1:4410/', { waitUntil: 'load' });
    await expect(Date.now() - start).toBeLessThan(3000);
  });

  test('server responds and the home page is ready quickly', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/');
    const timing = await page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return { firstByte: navigation.responseStart, domReady: navigation.domContentLoadedEventEnd };
    });
    await expect(timing.firstByte).toBeLessThan(800);
    await expect(timing.domReady).toBeLessThan(2000);
  });
});