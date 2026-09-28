// TFP-115 (Phase 34, Decision 2): read-only performance checks that need no
// target-specific knowledge. Budgets are deliberately loose - they are
// measured from wherever TestForge runs, over that machine's network, so a
// tight budget on an arbitrary site gives flaky results people learn to
// ignore. Each fails only on a clear problem, and every failure says what was
// measured, what the budget is and what it means, and names the culprit.
//
// The generated code avoids template literals so it can be written here
// without a second layer of escaping.

export const NAVIGATION_BUDGET_MS = 5000;
export const LCP_BUDGET_MS = 4000; // Core Web Vitals boundary for "poor"
export const PAGE_WEIGHT_BUDGET_BYTES = 5 * 1024 * 1024; // roughly twice a typical page

/**
 * The navigation-timing budget. It used to load with
 * `waitUntil: 'domcontentloaded'` and read the navigation entry's
 * `duration`, which stays 0 until the load event has finished - so it
 * measured 0 ms and passed whatever the page did. It now waits for the
 * load event to complete before reading the timing.
 */
function navigationTimingTest(path: string) {
    return `  test('landing page finishes loading within ${NAVIGATION_BUDGET_MS / 1000} s', async ({ page }) => {
    const response = await page.goto('${path}', { waitUntil: 'load' });
    expect(response, 'no response for ${path}').not.toBeNull();
    expect(response!.status(), '${path} answered with HTTP ' + response!.status()).toBeLessThan(400);

    await page.waitForFunction(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return !!entry && entry.loadEventEnd > 0;
    });
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return { total: entry.duration, firstByte: entry.responseStart, domReady: entry.domContentLoadedEventEnd };
    });

    expect(
      navigation.total,
      'navigation ' + Math.round(navigation.total) + ' ms, budget ${NAVIGATION_BUDGET_MS} ms: the page took too long to load' +
        ' (first byte after ' + Math.round(navigation.firstByte) + ' ms, DOM ready after ' + Math.round(navigation.domReady) + ' ms)'
    ).toBeLessThan(${NAVIGATION_BUDGET_MS});
  });`;
}

function largestContentfulPaintTest(path: string) {
    return `  test('largest contentful paint stays under ${LCP_BUDGET_MS / 1000} s', async ({ page }) => {
    await page.goto('${path}', { waitUntil: 'load' });

    // The browser's own largest-contentful-paint entries; the last one is the final LCP.
    const lcp = await page.evaluate(() => new Promise<{ time: number; element: string } | null>((resolve) => {
      let latest: { startTime: number; element?: Element | null; url?: string } | null = null;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        latest = entries[entries.length - 1] as unknown as { startTime: number; element?: Element | null; url?: string };
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => {
        observer.disconnect();
        if (!latest) return resolve(null);
        const el = latest.element;
        const text = el && el.textContent ? ' "' + el.textContent.trim().slice(0, 60) + '"' : '';
        const name = el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + text : '';
        resolve({ time: latest.startTime, element: name || latest.url || 'unknown element' });
      }, 1000);
    }));

    if (!lcp) {
      // No contentful paint at all (e.g. an empty or canvas-only page): nothing to judge.
      test.info().annotations.push({ type: 'finding', description: 'the browser reported no largest contentful paint for ${path}' });
      return;
    }
    expect(
      lcp.time,
      'LCP ' + (lcp.time / 1000).toFixed(2) + ' s, budget ${(LCP_BUDGET_MS / 1000).toFixed(1)} s: Core Web Vitals "poor". Largest element: ' + lcp.element
    ).toBeLessThan(${LCP_BUDGET_MS});
  });`;
}

function pageWeightTest(path: string) {
    return `  test('page weight stays under ${PAGE_WEIGHT_BUDGET_BYTES / 1024 / 1024} MB', async ({ page }) => {
    // Sizes as the browser received them, for every request - cross-origin
    // ones included, which the Resource Timing API would report as 0 bytes.
    const sizes: Array<Promise<{ url: string; bytes: number }>> = [];
    page.on('requestfinished', (request) => {
      sizes.push(request.sizes().then((s) => ({ url: request.url(), bytes: s.responseBodySize + s.responseHeadersSize })).catch(() => ({ url: request.url(), bytes: 0 })));
    });
    await page.goto('${path}', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const resources = await Promise.all(sizes);
    const total = resources.reduce((sum, r) => sum + r.bytes, 0);
    const largest = [...resources]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((r) => Math.round(r.bytes / 1024) + ' KB ' + r.url)
      .join('; ');
    expect(
      total,
      'page weight ' + (total / 1048576).toFixed(1) + ' MB over ' + resources.length + ' requests, budget ${PAGE_WEIGHT_BUDGET_BYTES / 1024 / 1024} MB: clearly bloated. Largest: ' + largest
    ).toBeLessThan(${PAGE_WEIGHT_BUDGET_BYTES});
  });`;
}

function failedRequestsTest(path: string) {
    return `  test('no same-origin request fails while the page loads', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? '${path}', 'http://placeholder.invalid').origin;
    const failures: string[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) {
        failures.push('HTTP ' + response.status() + ' ' + response.url());
      }
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'failed';
      // An aborted request was cancelled by the page itself (navigation, a
      // superseded fetch), not refused by the server.
      if (new URL(request.url()).origin === origin && !/ERR_ABORTED/.test(reason)) {
        failures.push(reason + ' ' + request.url());
      }
    });
    await page.goto('${path}', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    expect(failures, 'same-origin requests failed while ${path} loaded: ' + failures.join('; ')).toEqual([]);
  });`;
}

/**
 * Decision 2's checks for the landing page. `includeNavigation` is false when
 * the target-specific builder already wrote its own navigation-timing test.
 */
export function buildPerformanceChecks({ path = "/", includeNavigation = true }: { path?: string; includeNavigation?: boolean } = {}): string[] {
    return [
        ...(includeNavigation ? [navigationTimingTest(path)] : []),
        largestContentfulPaintTest(path),
        pageWeightTest(path),
        failedRequestsTest(path),
    ];
}
