/**
 * Phase 42 (TFP-190, Decision 1): a site's suite is saved in TestForge's data
 * folder with each page type's fingerprint, and reused on later runs. Run
 * through POST /api/generate on the comparison fixture's /types shop, with
 * the pages inspected in a real browser, as a run does.
 *
 * ISTQB technique: decision table. Conditions: whether the site changed since
 * the saved suite (no; one page's structure; a page removed) and whether a
 * saved test was edited by hand. One column each:
 *   unchanged site                       -> every test reused, none generated, the same suite
 *   one page's structure changed         -> only that page type's tests regenerated; the rest reused
 *   a page removed                       -> its tests retired, and the other pages' tests of it
 *   a hand-edited test, its page changed -> kept as edited, never regenerated, and flagged
 * Plus: nothing is written inside the repo; the data folder is where the
 * platform keeps app data (equivalence partitioning over the platforms).
 * Gate: Phase 42 Gate A.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/site-suites/site-suites.test.ts
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { after, before, test } from "node:test";
import type { SiteSuiteManifest } from "./store.ts";

const { POST } = await import("../../app/api/generate/route.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { dataDir } = await import("../storage/data-dir.ts");
const { parseTestUnits, withId } = await import("./units.ts");
const needsChromium = await chromiumSkipReason();

const PATHS = ["types", "types/product/101", "types/product/102", "types/product/103", "types/category/tools", "types/category/garden", "types/account/login", "types/account/contact", "types/legal/privacy", "types/help/terms"];
const ACCOUNT = "/types/account/:slug";

let fixture: Awaited<ReturnType<typeof startRecordedFixture>>;
const savedDataDir = process.env.TESTFORGE_DATA_DIR;
const folders: string[] = [];
const repoStatus = () => execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
let statusBefore = "";

before(async () => {
    if (needsChromium) return;
    statusBefore = repoStatus();
    fixture = await startRecordedFixture();
});

after(async () => {
    await fixture?.close();
    if (savedDataDir === undefined) delete process.env.TESTFORGE_DATA_DIR;
    else process.env.TESTFORGE_DATA_DIR = savedDataDir;
    for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A fresh, empty data folder for one column of the table. */
function freshDataDir() {
    const folder = mkdtempSync(join(tmpdir(), "testforge-data-"));
    folders.push(folder);
    process.env.TESTFORGE_DATA_DIR = folder;
    return folder;
}

async function generate(paths = PATHS) {
    const response = await POST(new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: fixture.origin, description: "Check the shop.", selectedPractices: ["functional", "accessibility", "seo"], contentRules: { paths } }),
        headers: { "content-type": "application/json" },
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.pageInspection?.status, "inspected", JSON.stringify(body.pageInspection));
    return body as { code: string; siteSuite: import("../report/types.ts").SiteSuiteRecord };
}

const manifestOf = async (store: string) => JSON.parse(await readFile(join(store, "manifest.json"), "utf8")) as SiteSuiteManifest;

test("an unchanged site: the second run reuses every test and generates none (TFP-190)", { skip: needsChromium }, async () => {
    const folder = freshDataDir();
    await fixture.control("/__fixture/defect?set=none");
    const first = await generate();
    const total = parseTestUnits(first.code).length;
    assert.ok(total > 100, `the template wrote ${total} tests for the /types pages`);
    assert.equal(first.siteSuite.firstRun, true);
    assert.equal(first.siteSuite.generated, total);
    assert.ok(!relative(folder, first.siteSuite.store).startsWith(".."), `the suite is saved in the data folder: ${first.siteSuite.store}`);

    const second = await generate();
    assert.deepEqual({ ...second.siteSuite, store: "" }, { store: "", firstRun: false, reused: total, generated: 0, regenerated: 0, retired: 0, edited: 0, changedTypes: [], newTypes: [], goneTypes: [], editedOnChangedPages: [] });
    assert.equal(second.code, first.code, "the reused suite is the suite that was saved");
});

test("one page's structure changes: only its page type's tests are regenerated, and a hand-edited one is kept and flagged (TFP-190)", { skip: needsChromium }, async () => {
    freshDataDir();
    await fixture.control("/__fixture/defect?set=none");
    const first = await generate();
    const before = await manifestOf(first.siteSuite.store);

    // A person edits one of the contact page's saved tests.
    const editedTitle = "every form field has an accessible name: /types/account/contact";
    const editedUnit = before.units.find((unit) => unit.title === editedTitle);
    assert.ok(editedUnit, `a saved test titled "${editedTitle}"`);
    assert.equal(editedUnit.type, ACCOUNT);
    const file = join(first.siteSuite.store, "tests", editedUnit.unit);
    // The test takes the shared visit since TFP-214 (`{ tfShared }`), or its own page.
    const edit = (await readFile(file, "utf8")).replace(/async \(\{ (page|tfShared) \}\) => \{/, (start) => `${start}\n  // Edited by hand: checked against the support team's list.`);
    assert.notEqual(edit, await readFile(file, "utf8"), "the hand edit applied");
    await writeFile(file, edit, "utf8");

    await fixture.control("/__fixture/defect?set=types-contact-phone");
    const second = await generate();
    const afterChange = await manifestOf(second.siteSuite.store);
    const accountTests = afterChange.units.filter((unit) => unit.type === ACCOUNT);

    assert.deepEqual(second.siteSuite.changedTypes, [ACCOUNT]);
    assert.deepEqual([second.siteSuite.newTypes, second.siteSuite.goneTypes], [[], []]);
    assert.equal(second.siteSuite.edited, 1);
    assert.deepEqual(second.siteSuite.editedOnChangedPages, [`${editedTitle} (${ACCOUNT} changed)`]);
    assert.equal(second.siteSuite.regenerated, accountTests.length - 1, "every account test but the edited one");
    assert.equal(second.siteSuite.generated, 0);
    assert.equal(second.siteSuite.reused, afterChange.units.length - accountTests.length, "every other type's tests, and the site-wide ones");
    assert.match(second.code, /Phone/, "the regenerated tests are the changed page's");

    // Measured on the saved suite: every test whose file was rewritten is an account test.
    const savedBefore = new Map(before.units.map((unit) => [unit.key, unit.writtenHash]));
    const rewritten = afterChange.units.filter((unit) => savedBefore.get(unit.key) !== unit.writtenHash);
    assert.ok(rewritten.length > 0);
    assert.deepEqual([...new Set(rewritten.map((unit) => unit.type))], [ACCOUNT]);
    // Retired: the contact tests whose titles named the old form; nothing of another type.
    const keptKeys = new Set(afterChange.units.map((unit) => unit.key));
    const retired = before.units.filter((unit) => !keptKeys.has(unit.key));
    assert.equal(second.siteSuite.retired, retired.length);
    assert.deepEqual([...new Set(retired.map((unit) => unit.type))], retired.length ? [ACCOUNT] : []);

    // The edit survives, in the suite and on disk.
    const editedInSuite = parseTestUnits(second.code).find((unit) => unit.title === editedTitle);
    assert.ok(editedInSuite);
    assert.equal(editedInSuite.source, withId(edit, editedInSuite.id));
    assert.equal(await readFile(file, "utf8"), edit);
});

test("a page is removed: its tests, and the other pages' tests of it, are retired (TFP-190)", { skip: needsChromium }, async () => {
    freshDataDir();
    await fixture.control("/__fixture/defect?set=none");
    const first = await generate();
    const before = await manifestOf(first.siteSuite.store);
    const privacyType = Object.keys(before.types).find((type) => before.types[type].paths.includes("/types/legal/privacy"));
    assert.ok(privacyType);
    const privacyTests = before.units.filter((unit) => unit.type === privacyType);
    assert.ok(privacyTests.length > 0);

    // The crawl no longer finds the page: it isn't linked and answers 404.
    await fixture.control("/__fixture/defect?set=types-privacy-removed");
    const second = await generate(PATHS.filter((path) => path !== "types/legal/privacy"));
    const afterRemoval = await manifestOf(second.siteSuite.store);

    assert.deepEqual(second.siteSuite.goneTypes, [privacyType]);
    assert.deepEqual(second.siteSuite.changedTypes, []);
    const keptKeys = new Set(afterRemoval.units.map((unit) => unit.key));
    assert.deepEqual(privacyTests.filter((unit) => keptKeys.has(unit.key)), [], "none of the removed page's tests is kept");
    assert.deepEqual(parseTestUnits(second.code).filter((unit) => unit.title.includes("/types/legal/privacy")).map((unit) => unit.title), [], "no test of the removed page is left in the suite");
    assert.equal(second.siteSuite.retired, before.units.filter((unit) => !keptKeys.has(unit.key)).length);
    assert.ok(second.siteSuite.retired > privacyTests.length, "the other pages' link tests to it are retired too");
    // The other page types are unchanged: their remaining tests are reused.
    assert.ok(second.siteSuite.reused > 0);
    assert.equal(afterRemoval.units.filter((unit) => unit.type !== "site" && !before.types[unit.type]).length, 0);
});

test("nothing is written inside the repo (TFP-190)", { skip: needsChromium }, async () => {
    assert.equal(repoStatus(), statusBefore);
});

test("the data folder: TESTFORGE_DATA_DIR, else where the platform keeps app data (equivalence partitioning)", () => {
    const home = "/home/emil";
    assert.equal(dataDir({ TESTFORGE_DATA_DIR: " /srv/tf-data " }, "win32", home), resolve("/srv/tf-data"));
    assert.equal(dataDir({ LOCALAPPDATA: "C:\\Users\\Emil\\AppData\\Local" }, "win32", home), join("C:\\Users\\Emil\\AppData\\Local", "TestForge"));
    assert.equal(dataDir({}, "win32", home), join(home, "AppData", "Local", "TestForge"));
    assert.equal(dataDir({}, "darwin", home), join(home, "Library", "Application Support", "TestForge"));
    assert.equal(dataDir({ XDG_DATA_HOME: "/data" }, "linux", home), join("/data", "testforge"));
    assert.equal(dataDir({ XDG_DATA_HOME: "  " }, "linux", home), join(home, ".local", "share", "testforge"));
});

/** Phase 42 (TFP-203 verification): the guard's helper reaches every describe. ISTQB technique: equivalence partitioning. */
test("withGuardHelper: a call another describe's copy can't reach gets a top-level one; a call beside its describe's copy, a top-level copy, or no call, nothing added", async () => {
    const { withGuardHelper } = await import("./reuse.ts");
    const scoped = "import { test } from '@playwright/test';\n\ntest.describe('Functional', () => {\nasync function tfReadOnlyGuarded(page: unknown, interact: () => Promise<void>) { await interact(); }\n  test('a', async ({ page }) => { await tfReadOnlyGuarded(page, async () => {}); });\n});\n\ntest.describe('Gap tests', () => {\n  test('b', async ({ page }) => { await tfReadOnlyGuarded(page, async () => {}); });\n});\n";
    const fixed = withGuardHelper(scoped);
    assert.ok(fixed.indexOf("async function tfReadOnlyGuarded") < fixed.indexOf("test.describe('Functional'"), "a top-level copy, before the first describe");
    assert.equal(fixed.split("async function tfReadOnlyGuarded").length - 1, 2);
    assert.equal(withGuardHelper(fixed), fixed, "a top-level copy is enough");
    // TFP-204: tests appended inside the describe that declares it reach that copy.
    const sameDescribe = scoped.slice(0, scoped.indexOf("\n\ntest.describe('Gap tests'")) + "\n";
    assert.equal(withGuardHelper(sameDescribe), sameDescribe);
    const plain = "import { test } from '@playwright/test';\n\ntest('c', async ({ page }) => { await page.goto('/'); });\n";
    assert.equal(withGuardHelper(plain), plain);
});
