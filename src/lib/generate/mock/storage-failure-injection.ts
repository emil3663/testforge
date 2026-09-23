import { escapeForSingleQuotedString } from "./format";
import type { ContentProfile, StorageKind } from "./types";

export const STORAGE_KINDS: StorageKind[] = ["localStorage", "sessionStorage", "indexedDB"];

// The exact, unescaped title text the generated test below produces -
// matched against executed test titles by discovered-coverage.ts, the
// same pattern buildDependencyFailureTitle established for TFP-085.
export function buildStorageFailureTitle(path: string, kind: StorageKind) {
    return `storage failure injection: ${kind} on ${path}`;
}

// TFP-086: mocks the entry point itself to throw - not a specific corrupted
// value (that's schema-aware seeding, out of scope per Decision 3's
// [PLACEHOLDER]). localStorage/sessionStorage are properties (a getter
// override throws on first access); indexedDB.open is a method (wrapped to
// throw when called) - mirrors installStorageAccessProbe's own
// getter/wrapper split in introspect/storage-probe.ts, this time throwing
// instead of recording.
function breakStorageInitScript(kind: StorageKind): string {
    if (kind === "indexedDB") {
        return `() => {
      try {
        if (window.indexedDB) {
          window.indexedDB.open = () => { throw new Error('storage entry point mocked to fail (TestForge TFP-086)'); };
        }
      } catch (e) {}
    }`;
    }

    return `() => {
      try {
        Object.defineProperty(window, '${kind}', {
          configurable: true,
          get() { throw new Error('storage entry point mocked to fail (TestForge TFP-086)'); },
        });
      } catch (e) {}
    }`;
}

// One test per (page, storage kind) TFP-086's introspect-time behavioral
// probe actually detected in use - never generated for a kind/page the
// probe found no real access on, so a target that doesn't touch storage
// gets no storage-failure test at all (no false-positive coverage claim).
export function buildStorageFailureTests(contentProfile: ContentProfile | null): string[] {
    const pages = contentProfile?.pages ?? [];
    const tests: string[] = [];

    for (const page of pages) {
        const usage = page.storageUsage;
        if (!usage) {
            continue;
        }

        for (const kind of STORAGE_KINDS) {
            if (!usage[kind]) {
                continue;
            }

            const escapedPath = escapeForSingleQuotedString(page.path);
            const title = escapeForSingleQuotedString(buildStorageFailureTitle(page.path, kind));

            tests.push(`  test('${title}', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.addInitScript(${breakStorageInitScript(kind)});

    const response = await page.goto('${escapedPath}', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    expect(response?.status() ?? 0, 'the page itself should still respond with ${kind} mocked to fail').toBeLessThan(500);
    await expect(page.locator('body'), 'the page should still render a body, not a blank crash screen').toBeVisible();
    expect(pageErrors, 'no uncaught page errors after ${kind} was mocked to fail: ' + pageErrors.join('; ')).toEqual([]);
  });`);
        }
    }

    return tests;
}
