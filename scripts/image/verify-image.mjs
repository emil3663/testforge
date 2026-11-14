// Phase 47 (TFP-247): runs a built image and asserts on what it writes, so a green release could have gone red
// (Acceptance Criteria 4, the verified-release-pipeline skill). A built image proves nothing until it has run:
//   1. its pins (check-pins.mjs in the image): Ubuntu 26.04 (TFP-284), .nvmrc's Node, the lockfile's Playwright and Chromium;
//   2. `--help` exits 0 with the usage;
//   3. a real run on the comparison fixture, which the image itself starts with --server: --report-only exits 0, the
//      JUnit totals are the report's, at least one test executed, and the report says which Mr Onion made it;
//   4. the same run without --report-only fails at least one test and exits 1 (TFP-248), so the failing path runs;
//   5. an unreachable URL exits 2.
// Every run is the caller's user, as the action runs it (TFP-248); on Linux, what it wrote must be that user's.
// Exit 0 when every check holds; 1 naming each one that didn't.
//
//   node scripts/image/verify-image.mjs <image> [--version <v>] [--commit <sha>]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** The `tests`, `failures`, `errors` and `skipped` of junit.xml's <testsuites>, or null. */
export function junitTotals(xml) {
    const open = /<testsuites\b([^>]*)>/.exec(xml)?.[1];
    if (open === undefined) return null;
    const read = (name) => {
        const value = new RegExp(`\\b${name}="(\\d+)"`).exec(open)?.[1];
        return value === undefined ? NaN : Number(value);
    };
    return { tests: read("tests"), failures: read("failures"), errors: read("errors"), skipped: read("skipped") };
}

/** What a run's report and JUnit say that they shouldn't; empty when they agree with each other and with `expected`. */
export function outputFailures(result, junitXml, expected = {}) {
    const failures = [];
    const summary = result?.report?.summary;
    if (!summary) return ["report.json has no report summary"];
    const totals = junitXml === null ? null : junitTotals(junitXml);
    if (!totals) failures.push("junit.xml is missing or has no <testsuites>");
    else {
        const pairs = [["tests", "planned"], ["failures", "failed"], ["errors", "blocked"], ["skipped", "notRun"]];
        for (const [junit, report] of pairs) {
            if (totals[junit] !== summary[report]) failures.push(`junit.xml ${junit}=${totals[junit]}; the report's ${report} is ${summary[report]}`);
        }
    }
    if (!(summary.executed > 0)) failures.push(`no test executed (executed=${summary.executed})`);
    if (expected.version !== undefined && result.producedBy?.version !== expected.version) failures.push(`the report says version ${result.producedBy?.version}; expected ${expected.version}`);
    if (expected.commit !== undefined && result.producedBy?.commit !== expected.commit) failures.push(`the report says commit ${result.producedBy?.commit}; expected ${expected.commit}`);
    return failures;
}

/**
 * TFP-248: the verdict run on the fixture must fail a test and exit 1 (Decision 5, no baseline), so every release runs
 * the failing path. A run that passes everything exits 0 rightly, and proves nothing about a failing one.
 */
export function verdictFailures(result, status) {
    const failures = [];
    if (!(result.report.summary.failed > 0)) failures.push(`no test failed (failed=${result.report.summary.failed}), so the failing path wasn't run`);
    if (status !== 1) failures.push(`exited ${status}, not 1`);
    return failures;
}

/** TFP-248: the files under a workspace that its user doesn't own (`files`: each one's path and uid), up to three named. */
export function ownershipFailures(files, uid) {
    const foreign = files.filter((file) => file.uid !== uid);
    if (foreign.length === 0) return [];
    const named = foreign.slice(0, 3).map((file) => `${file.path} (uid ${file.uid})`).join(", ");
    return [`${foreign.length} file(s) in the workspace aren't owned by uid ${uid}: ${named}${foreign.length > 3 ? ", ..." : ""}`];
}

/** Every file and folder under `dir`, with its owner's uid. */
function ownersUnder(dir) {
    return readdirSync(dir, { recursive: true }).map((path) => ({ path, uid: statSync(join(dir, path)).uid }));
}

/** What check-pins.mjs printed that disagrees with the repo; empty when it agrees. */
export function pinsFailures(pins, lock) {
    const failures = [];
    if (pins?.os !== "26.04") failures.push(`the image's Ubuntu is ${pins?.os}, not 26.04 (CI's runner pin)`); // TFP-284: was 24.04
    const locked = lock.packages?.["node_modules/playwright-core"]?.version;
    if (pins?.playwright !== locked) failures.push(`the image's Playwright is ${pins?.playwright}; the lockfile says ${locked}`);
    return failures;
}

function main(argv) {
    const [image, ...rest] = argv;
    if (!image) {
        console.error("usage: node scripts/image/verify-image.mjs <image> [--version <v>] [--commit <sha>]");
        return 2;
    }
    const flag = (name) => {
        const at = rest.indexOf(name);
        return at === -1 ? undefined : rest[at + 1];
    };
    const expected = {
        version: flag("--version") ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
        commit: flag("--commit"),
    };
    const failures = [];
    const check = (name, problems) => {
        console.log(`${problems.length === 0 ? "ok  " : "FAIL"} ${name}`);
        for (const problem of problems) console.log(`       ${problem}`);
        failures.push(...problems.map((problem) => `${name}: ${problem}`));
    };
    const docker = (args) => {
        const started = Date.now();
        const run = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        return { ...run, seconds: Math.round((Date.now() - started) / 1000) };
    };
    // A run's own workspace, mounted where the image's commands resolve --out (WORKDIR /work).
    const workspace = () => {
        const dir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "mr-onion-image-"));
        return { dir, mount: ["--mount", `type=bind,src=${dir},dst=/work`] };
    };
    // TFP-248: as the action runs it, as the caller's user, never root (on Windows, which has no uid, a non-root one).
    const uid = process.getuid?.() ?? 1000;
    const runArgs = ["run", "--rm", "--init", "--ipc=host", "--user", `${uid}:${process.getgid?.() ?? 1000}`];

    const pins = docker([...runArgs, "--entrypoint", "node", image, "/opt/mr-onion/scripts/image/check-pins.mjs"]);
    let printed = null;
    try {
        printed = JSON.parse(pins.stdout.trim().split("\n").pop());
    } catch {
        // reported below
    }
    console.log(`pins: ${pins.stdout.trim()}${pins.stderr.trim() ? `\n${pins.stderr.trim()}` : ""}`);
    check("the pins", pins.status !== 0 ? [`check-pins.mjs exited ${pins.status}`] : pinsFailures(printed, JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))));

    const help = docker([...runArgs, image, "run", "--help"]);
    check("--help", [
        ...(help.status === 0 ? [] : [`exited ${help.status}`]),
        ...(/mr-onion run/.test(help.stdout) ? [] : ["the usage doesn't name `mr-onion run`"]),
    ]);

    // The fixture is started by the image itself, so the run is the image's alone and needs no host network.
    const fixtureRun = (reportOnly) => {
        const { dir, mount } = workspace();
        const run = docker([
            ...runArgs, ...mount, image, "run", "--url", "http://localhost:4410",
            "--server", "node /opt/mr-onion/scripts/comparison-fixture.mjs --port 4410", "--port", "4410",
            "--out", "out", ...(reportOnly ? ["--report-only"] : []),
        ]);
        console.log(`  (${reportOnly ? "--report-only" : "verdict"} run: exit ${run.status}, ${run.seconds} s; last line: ${run.stdout.trim().split("\n").pop()})`);
        const read = (name) => {
            try {
                return readFileSync(join(dir, "out", name), "utf8");
            } catch {
                return null;
            }
        };
        const report = read("report.json");
        return { run, dir, result: report === null ? null : JSON.parse(report), junit: read("junit.xml") };
    };

    const reportOnly = fixtureRun(true);
    check("a run on the fixture, --report-only", [
        ...(reportOnly.run.status === 0 ? [] : [`exited ${reportOnly.run.status}, not 0; its last lines:\n${`${reportOnly.run.stdout}\n${reportOnly.run.stderr}`.trim().split("\n").slice(-5).join("\n")}`]),
        ...(reportOnly.result ? outputFailures(reportOnly.result, reportOnly.junit, expected) : ["wrote no report.json"]),
    ]);
    if (reportOnly.result?.report) {
        const { planned, executed, passed, failed, blocked, notRun } = reportOnly.result.report.summary;
        console.log(`       planned ${planned}, executed ${executed}, passed ${passed}, failed ${failed}, blocked ${blocked}, not run ${notRun}`);
    }
    // Only Linux keeps a container's owners on a mounted folder; Docker Desktop's file sharing maps them to the caller.
    if (process.platform === "linux") check("the workspace's files are the caller's", ownershipFailures(ownersUnder(reportOnly.dir), uid));

    const verdict = fixtureRun(false);
    check("the same run's verdict", verdict.result?.report
        ? [...verdictFailures(verdict.result, verdict.run.status), ...outputFailures(verdict.result, verdict.junit, expected)]
        : [`exited ${verdict.run.status} and wrote no report`]);

    const { mount } = workspace();
    const unreachable = docker([...runArgs, ...mount, image, "run", "--url", "http://localhost:9", "--out", "out"]);
    check("an unreachable URL", unreachable.status === 2 ? [] : [`exited ${unreachable.status}, not 2`]);

    console.log(failures.length === 0 ? `verify-image: ${image}: every check holds` : `verify-image: ${image}: ${failures.length} check(s) failed`);
    return failures.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
