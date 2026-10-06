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

// Phase 38 Decision 5 (TFP-149): Core Web Vitals' three bands, as published
// on web.dev (checked 2026-10-05). Up to the "good" line passes; above it, up
// to the "poor" line, is a finding ("needs improvement"); beyond it fails.
// The LCP failure line is LCP_BUDGET_MS, unchanged. Not changed without a
// decision.
export const LCP_GOOD_MS = 2500;
export const CLS_GOOD = 0.1;
export const CLS_POOR = 0.25;

/**
 * Decision 5: every performance finding and failure says it was measured
 * once, in a lab, so it does not read as the site's field score (web.dev
 * judges Core Web Vitals at the 75th percentile of real visits). Written
 * into single-quoted generated strings, so it holds no quote.
 */
export const LAB_NOTE = "Measured once, in a lab (this run, from this machine), not from real visits.";

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
        ' (first byte after ' + Math.round(navigation.firstByte) + ' ms, DOM ready after ' + Math.round(navigation.domReady) + ' ms). ${LAB_NOTE}'
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
      test.info().annotations.push({ type: 'finding', description: 'the browser reported no largest contentful paint for ${path}. ${LAB_NOTE}' });
      return;
    }
    // Core Web Vitals bands (web.dev, checked 2026-10-05): up to ${LCP_GOOD_MS / 1000} s good, up to ${LCP_BUDGET_MS / 1000} s needs improvement, beyond that poor.
    if (lcp.time > ${LCP_GOOD_MS} && lcp.time <= ${LCP_BUDGET_MS}) {
      test.info().annotations.push({ type: 'finding', description: 'LCP ' + (lcp.time / 1000).toFixed(2) + ' s on ${path}: Core Web Vitals "needs improvement" (over ${(LCP_GOOD_MS / 1000).toFixed(1)} s, up to ${(LCP_BUDGET_MS / 1000).toFixed(1)} s). Largest element: ' + lcp.element + '. ${LAB_NOTE}' });
    }
    expect(
      lcp.time,
      'LCP ' + (lcp.time / 1000).toFixed(2) + ' s, budget ${(LCP_BUDGET_MS / 1000).toFixed(1)} s: Core Web Vitals "poor". Largest element: ' + lcp.element + '. ${LAB_NOTE}'
    ).toBeLessThanOrEqual(${LCP_BUDGET_MS});
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
      'page weight ' + (total / 1048576).toFixed(1) + ' MB over ' + resources.length + ' requests, budget ${PAGE_WEIGHT_BUDGET_BYTES / 1024 / 1024} MB: clearly bloated. Largest: ' + largest + '. ${LAB_NOTE}'
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

    expect(failures, 'same-origin requests failed while ${path} loaded: ' + failures.join('; ') + '. ${LAB_NOTE}').toEqual([]);
  });`;
}

/**
 * Decision 5: CLS, measured during load - web.dev notes lab tools only see
 * the shifts of the page load. CLS is the largest session window of layout
 * shifts without recent input (a window ends after a 1 s gap or at 5 s).
 * The observer sees the load and 1.5 s after it.
 */
function cumulativeLayoutShiftTest(path: string) {
    return `  test('cumulative layout shift during load stays under ${CLS_POOR}', async ({ page }) => {
    await page.goto('${path}', { waitUntil: 'load' });

    const cls = await page.evaluate(() => new Promise<{ value: number; sources: string }>((resolve) => {
      const shifts: Array<{ value: number; time: number; sources: string }> = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ value: number; startTime: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }>) {
          if (entry.hadRecentInput) continue;
          const sources = (entry.sources ?? []).map((source) => {
            const node = source.node as Element | null | undefined;
            return node && node.tagName ? node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') : 'unknown';
          }).slice(0, 3).join(', ');
          shifts.push({ value: entry.value, time: entry.startTime, sources });
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => {
        observer.disconnect();
        let best = { value: 0, sources: '' };
        let current = { value: 0, sources: '', start: -Infinity, last: -Infinity };
        for (const shift of shifts.sort((a, b) => a.time - b.time)) {
          if (shift.time - current.last > 1000 || shift.time - current.start > 5000) current = { value: 0, sources: '', start: shift.time, last: shift.time };
          current.value += shift.value;
          current.last = shift.time;
          current.sources = current.sources || shift.sources;
          if (current.value > best.value) best = { value: current.value, sources: current.sources };
        }
        resolve(best);
      }, 1500);
    }));

    const where = cls.sources ? ' Shifted first: ' + cls.sources + '.' : '';
    // Core Web Vitals bands (web.dev, checked 2026-10-05): up to ${CLS_GOOD} good, up to ${CLS_POOR} needs improvement, beyond that poor.
    if (cls.value > ${CLS_GOOD} && cls.value <= ${CLS_POOR}) {
      test.info().annotations.push({ type: 'finding', description: 'CLS ' + cls.value.toFixed(3) + ' on ${path}: Core Web Vitals "needs improvement" (over ${CLS_GOOD}, up to ${CLS_POOR}).' + where + ' ${LAB_NOTE}' });
    }
    expect(
      cls.value,
      'CLS ' + cls.value.toFixed(3) + ' on ${path}, budget ${CLS_POOR}: Core Web Vitals "poor": content moves while the page loads.' + where + ' ${LAB_NOTE}'
    ).toBeLessThanOrEqual(${CLS_POOR});
  });`;
}

/**
 * Decision 5: TBT is recorded as a measured value, with no pass or fail:
 * web.dev calls it a proxy for INP, not a substitute, and publishes no TBT
 * band. Long tasks are collected from before the page's own scripts run;
 * TBT is the sum over those after the first contentful paint of their time
 * beyond 50 ms, up to 1.5 s after load. INP itself needs a real interaction
 * and is not measured in this phase.
 */
function totalBlockingTimeTest(path: string) {
    return `  test('total blocking time during load (recorded, not judged)', async ({ page }) => {
    await page.addInitScript(() => {
      const tasks: Array<{ start: number; duration: number }> = [];
      (window as unknown as { __tfLongTasks: typeof tasks }).__tfLongTasks = tasks;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask' });
    });
    await page.goto('${path}', { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const tbt = await page.evaluate(() => {
      const tasks = (window as unknown as { __tfLongTasks?: Array<{ start: number; duration: number }> }).__tfLongTasks ?? [];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const blocking = tasks.filter((task) => task.start >= fcp).map((task) => Math.max(0, task.duration - 50));
      return { total: blocking.reduce((sum, ms) => sum + ms, 0), tasks: blocking.length };
    });
    test.info().annotations.push({ type: 'measurement', description: 'TBT ' + Math.round(tbt.total) + ' ms on ${path} (' + tbt.tasks + ' long task(s) after the first contentful paint, up to 1.5 s after load): recorded, not judged - web.dev calls TBT a proxy for INP, not a substitute, and gives it no band. ${LAB_NOTE}' });
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
        // Phase 38 Decision 5 (TFP-149).
        cumulativeLayoutShiftTest(path),
        totalBlockingTimeTest(path),
    ];
}
