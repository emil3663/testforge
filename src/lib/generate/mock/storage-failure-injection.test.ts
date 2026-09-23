/**
 * TFP-086: buildStorageFailureTests / buildStorageFailureTitle.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/storage-failure-injection.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { buildStorageFailureTests, buildStorageFailureTitle } from "./storage-failure-injection.ts";
import type { ContentProfile, ContentProfilePage, StorageUsage } from "./types";

function page(path: string, storageUsage: Partial<StorageUsage> = {}): ContentProfilePage {
    return {
        path,
        url: `https://app.example.com${path}`,
        title: "",
        metaDescription: "",
        headings: [],
        buttons: [],
        links: [],
        visibleTextSnippets: [],
        storageUsage: { localStorage: false, sessionStorage: false, indexedDB: false, ...storageUsage },
    };
}

function profile(pages: ContentProfilePage[]): ContentProfile {
    return { scannedAt: "", baseUrl: "https://app.example.com", pages };
}

test("a target that doesn't touch storage at all generates no storage-failure test", () => {
    const tests = buildStorageFailureTests(profile([page("/")]));
    assert.strictEqual(tests.length, 0);
});

test("a page with no storageUsage field at all (older/malformed data) generates no test, not a crash", () => {
    const bareProfile: ContentProfile = {
        scannedAt: "", baseUrl: "https://app.example.com",
        pages: [{ path: "/", url: "https://app.example.com/", title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [] }],
    };
    assert.strictEqual(buildStorageFailureTests(bareProfile).length, 0);
});

test("one test per detected (page, storage kind) - not one per page, not one blanket test", () => {
    const tests = buildStorageFailureTests(profile([
        page("/", { localStorage: true, indexedDB: true }),
        page("/settings", { sessionStorage: true }),
    ]));

    assert.strictEqual(tests.length, 3);
});

test("the generated test title exactly matches buildStorageFailureTitle's output", () => {
    const [testBody] = buildStorageFailureTests(profile([page("/", { localStorage: true })]));
    assert.ok(testBody.includes(`test('${buildStorageFailureTitle("/", "localStorage")}'`));
});

test("localStorage/sessionStorage are broken via a getter override, indexedDB via wrapping .open", () => {
    const [localStorageTest] = buildStorageFailureTests(profile([page("/", { localStorage: true })]));
    assert.ok(localStorageTest.includes("Object.defineProperty(window, 'localStorage'"));

    const [indexedDBTest] = buildStorageFailureTests(profile([page("/", { indexedDB: true })]));
    assert.ok(indexedDBTest.includes("window.indexedDB.open ="));
});

test("asserts graceful degradation generically: body visible, no uncaught page errors, no 5xx", () => {
    const [testBody] = buildStorageFailureTests(profile([page("/", { localStorage: true })]));

    assert.ok(testBody.includes("page.locator('body')"));
    assert.ok(testBody.includes("pageErrors"));
    assert.ok(testBody.includes("toBeLessThan(500)"));
});
