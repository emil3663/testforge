/**
 * Phase 38 TFP-147, Acceptance Criteria 2 (security): the Standard run's
 * security checks are the Comprehensive run's passive checks, through the
 * same builders, on every inspected page, with one missing-page probe.
 *
 * On the comparison fixture, for the clean site and each injected
 * passive-security defect, a Standard security run and a Comprehensive
 * security run of the same pages report the same outcome, findings and
 * failure for every check on every page; each defect is found on the page
 * that carries it; and each Standard run sends exactly one missing-page
 * probe.
 *
 * ISTQB technique: equivalence partitioning - one partition per injected
 * defect (each a different class of exposure or hardening gap), plus the
 * clean site.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/standard-security.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";

const { mockGenerate } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const PAGES = ["/", "/login", "/notes"];
const PROBE = "/testforge-missing-";

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `standard-security-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

/** Each passive check by page and title (ids dropped): its outcome, findings and failure, the probe's random path masked. */
interface Outcome {
    status: ExecutionRecord["status"];
    findings: string[];
    failure: string;
}

function outcomes(records: ExecutionRecord[]): Record<string, Outcome> {
    const mask = (text: string) => text.replace(/\/testforge-missing-[a-z0-9]+/g, "/testforge-missing-<id>");
    return Object.fromEntries(records
        .filter((record) => record.page)
        .map((record): [string, Outcome] => [`${record.page} | ${record.title.replace(/^TF[A-Z]+-\d+: /, "")}`, {
            status: record.status,
            findings: [...(record.findings ?? [])].map(mask).sort(),
            failure: record.status === "Failed" ? mask(record.rawMessage.split("\n")[0]) : "",
        }])
        .sort(([a], [b]) => a.localeCompare(b)));
}

// What each defect must change, and where: [page, check title, what the outcome must contain].
const DEFECTS: Record<string, { page: string; check: string; shows: RegExp }> = {
    "security-password-to-http": { page: "/login", check: "/login keeps passwords off plain HTTP", shows: /sends a password field to the plain-HTTP address http:\/\/login\.acme-notes\.invalid\/session/ },
    "security-token-in-url": { page: "/", check: "/ puts no password or session token in a URL", shows: /carries sessionid in its URL/ },
    "security-stack-trace": { page: "(missing-page probe)", check: "a page that cannot exist shows no stack trace or server file path", shows: /stack trace|server file path/ },
    "security-version-header": { page: "/", check: "/ names no software version in its response headers", shows: /x-powered-by: Express\/4\.18\.2 on \/ names a software version/ },
    "security-weak-session-cookie": { page: "/", check: "/ sends its security headers and session cookies", shows: /session cookie "sid" set on \/ (has no HttpOnly|stays valid for 400 days)/ },
    "security-mixed-cookies": { page: "/", check: "/ sends its security headers and session cookies", shows: /session cookie "sid" set on \/ has no HttpOnly/ },
};

test("in a real browser: on the fixture, a Standard security run and a Comprehensive one report the same for every page, for the clean site and each passive defect; the Standard run sends one missing-page probe", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, PAGES);
        assert.deepEqual(inspection.pages.map((page) => page.path), PAGES);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const standard = mockGenerate(fixture.origin, "Check the site.", ["security"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
        const mode = normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode;
        const comprehensive = buildComprehensiveSuite(fixture.origin, mode, { covered: PAGES, notCovered: [], pageCap: 20 });
        assert.deepEqual(findTypeErrors(standard), []);
        assert.doesNotMatch(standard, /landing page security headers|session cookies set by the site carry protective flags/, "Standard's own two tests are gone");

        let clean: ReturnType<typeof outcomes> | null = null;
        for (const defect of ["none", ...Object.keys(DEFECTS)]) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            fixture.recorded.length = 0;
            const standardOutcomes = outcomes(await runSuite(standard, "standard"));
            const probes = fixture.recorded.filter((request) => request.path.startsWith(PROBE)).length;
            const comprehensiveOutcomes = outcomes(await runSuite(comprehensive, "comprehensive"));

            assert.equal(probes, 1, `${defect}: the Standard run sends exactly one missing-page probe`);
            assert.equal(Object.keys(standardOutcomes).length, PAGES.length * 4 + 1, `${defect}: 4 checks per page and the probe`);
            assert.deepEqual(standardOutcomes, comprehensiveOutcomes, `${defect}: Standard and Comprehensive disagree`);

            if (defect === "none") {
                clean = standardOutcomes;
                assert.ok(Object.values(clean).every((outcome) => outcome.status === "Passed"), JSON.stringify(clean));
                continue;
            }
            const { page, check, shows } = DEFECTS[defect];
            const key = `${page} | ${check}`;
            const outcome = standardOutcomes[key];
            assert.ok(outcome, `${defect}: no ${key} in ${Object.keys(standardOutcomes).join(", ")}`);
            assert.notDeepEqual(outcome, clean![key], `${defect}: ${key} is the same as on the clean site`);
            assert.match([...outcome.findings, outcome.failure].join("\n"), shows, `${defect}: ${JSON.stringify(outcome)}`);
        }
    } finally {
        await fixture.close();
    }
});
