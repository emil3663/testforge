import { spawn } from "child_process";
import { readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
import { READ_ONLY_GUARD_HELPER } from "@/lib/generate/read-only-guard";
import { findTypeErrors } from "@/lib/generate/validate";
import { flattenSuites } from "@/lib/report/execution";
import { runEnv } from "@/lib/run/child-env";
import { createRunFolder, PLAYWRIGHT_RUNS_DIR, removeRunFolder } from "@/lib/run/run-folders";
import { forbiddenConstruct } from "./code-check";
import type { JsonReport } from "@/lib/report/types";
import type { GapTarget } from "./writers";

/**
 * Phase 42 (TFP-194, Decision 5): a written gap test, composed by TestForge
 * and run behind the gates before it can join a site suite.
 *
 * The writer gives only a test body. TestForge wraps it: a test at the
 * read-only gate, its whole body inside Phase 41's request guard, so any
 * request but GET, HEAD or QUERY and any form submission is aborted and
 * fails the test as a breach. A breach rejects the test outright.
 *
 * Before it runs, the body must type-check, and it must not reach for Node
 * (require, import(), process, the file system, child processes). A test
 * runs in Node, not only in the page, so model-written code is held to the
 * page and Playwright's API. This is a heuristic, not a sandbox.
 *
 * TFP-202: the check reads the body's syntax tree and covers the network and
 * code built at run time too (code-check.ts), and the test runs with only the
 * environment Playwright needs (src/lib/run/child-env.ts): no keys, tokens or
 * TestForge settings.
 */


export function gapTestTitle(target: GapTarget) {
    return `gap test: ${target.label ?? target.name} on ${target.page}`;
}

/**
 * The test as it is saved and run: title, the read-only gate, its page and target, and the body inside the guard.
 * TFP-203: a pool candidate bound as the gap's test also names the candidate, so its runs count as its evidence.
 */
export function composeGapTest(target: GapTarget, body: string, candidate?: string): string {
    const indented = body.split("\n").map((line) => (line.trim() ? `      ${line}` : "")).join("\n");
    return `  test('${escapeForSingleQuotedString(gapTestTitle(target))}', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${escapeForSingleQuotedString(target.page)}' }, { type: 'gap-test', description: '${escapeForSingleQuotedString(target.key)}' }${candidate ? `, { type: 'candidate', description: '${escapeForSingleQuotedString(candidate)}' }` : ""}] }, async ({ page }) => {
    await tfReadOnlyGuarded(page, async () => {
${indented}
    });
  });`;
}

export function gapSpec(baseUrl: string, tests: string[]): string {
    return `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${escapeForSingleQuotedString(baseUrl)}' });

${READ_ONLY_GUARD_HELPER}

${tests.join("\n\n")}
`;
}

export type GapRunOutcome =
    | { verdict: "passed" }
    | { verdict: "failed"; message: string }
    | { verdict: "breach"; message: string }
    | { verdict: "invalid"; message: string };

/** The checks before a run: Node access, then the type check of the whole spec. */
export function checkGapBody(baseUrl: string, target: GapTarget, body: string): GapRunOutcome | null {
    if (!body.trim()) return { verdict: "invalid", message: "the answer held no test body" };
    const reached = forbiddenConstruct(body);
    if (reached) return { verdict: "invalid", message: `the body uses ${reached}, which a gap test may not; it may use only the page, expect and Playwright's API, with no imports, no Node and no requests but the page's own` };
    const errors = findTypeErrors(gapSpec(baseUrl, [composeGapTest(target, body)]));
    return errors.length > 0 ? { verdict: "invalid", message: `the test does not type-check: ${errors.slice(0, 5).join("; ")}` } : null;
}

/** Runs one composed test with the Playwright CLI: Chromium, one worker, interactive tests off. */
export async function runGapTest(baseUrl: string, target: GapTarget, body: string): Promise<GapRunOutcome> {
    const invalid = checkGapBody(baseUrl, target, body);
    if (invalid) return invalid;
    return runGapSpec(gapSpec(baseUrl, [composeGapTest(target, body)]));
}

/** Runs one spec as given. Only for a spec whose bodies have passed checkGapBody (runGapTest), or a test's own. */
export async function runGapSpec(spec: string): Promise<GapRunOutcome> {
    const name = `gap-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // TFP-222: in a folder of its own, whose config's testDir is that folder, so no other run's folders reach its
    // start-up walk (TFP-208's race).
    const { dir, config } = await createRunFolder(PLAYWRIGHT_RUNS_DIR, `gap-${name}`);
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    // Artifacts outside the run's folder, as before.
    const outputDir = join(tmpdir(), `${name}-artifacts`);
    await writeFile(specFile, spec, "utf8");
    try {
        await new Promise<void>((resolve) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", "--config", config, "--reporter=json", "--project=chromium", "--timeout=30000", "--workers=1", `--output=${outputDir.replace(/\\/g, "/")}`], {
                cwd: process.cwd(),
                env: runEnv({ PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" }),
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", () => resolve());
            child.on("close", () => resolve());
        });
        const text = await readFile(jsonFile, "utf8").catch(() => "");
        const [record] = text ? flattenSuites((JSON.parse(text) as JsonReport).suites ?? []) : [];
        if (!record) return { verdict: "failed", message: "Playwright reported no result" };
        if (record.status === "Passed") return { verdict: "passed" };
        const message = (record.rawMessage || record.status).slice(0, 2000);
        return /read-only guard breach/.test(message) ? { verdict: "breach", message } : { verdict: "failed", message };
    } finally {
        await removeRunFolder(dir);
        await rm(outputDir, { recursive: true, force: true });
    }
}
