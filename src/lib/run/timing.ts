/**
 * Phase 39 (TFP-211, Decision 1): where a run's time goes, recorded outside the generated suite, so measuring
 * changes no test and no template output. A second Playwright reporter, beside the progress reporter, keeps
 * each test's browser calls as Playwright names them (Playwright 1.59):
 * - `Navigate to "<url>"`: a page load (`about:blank` loads, TFP-165's fresh-document step, are kept apart);
 * - `Wait for load state "networkidle"`: TFP-167's settle wait, ending in an error when it reaches its cap;
 * - `GET "<url>"`, `HEAD "<url>"`, ...: a request outside the page (link health's);
 * - `Expect ...` steps, an error when the assertion failed.
 * Steps inside fixtures (browser, context and page set-up) are left out: they aren't the test's own.
 *
 * summarizeTiming turns that into Decision 1's numbers for the run record: time in page loads and settle waits,
 * visits that hit the settle cap, time failing tests spend in steps that failed (waiting out their timeouts),
 * page visits per page and area, and the targets the four link checks share. countControlKinds counts each
 * selected page's controls by Decision 3's kinds, from the inspection, as data for the owner's later look.
 */
import { deriveArea } from "@/lib/report/execution";
import type { ContentProfile, LinkDetail } from "@/lib/generate/mock/types";
import { isRouteLink } from "@/lib/generate/mock/link-audits/routes";
import { readFile } from "fs/promises";
import { parseTestUnits } from "@/lib/site-suites/units";
import { SERIAL_UNIT } from "@/lib/run/split";

/** Set on the run's Playwright process: where the timing reporter writes. Unset, it writes nothing. */
export const TIMING_FILE_ENV_VAR = "TESTFORGE_TIMING_FILE";

export type TimingStepKind = "goto" | "blank" | "settle" | "request" | "expect" | "other";

export interface TimingStep {
    kind: TimingStepKind;
    /** The address loaded or requested; "" for other steps. */
    target: string;
    duration: number;
    failed: boolean;
}

export interface TimingTest {
    titlePath: string[];
    title: string;
    /** The test's `page` annotation: the page it is about. */
    page: string | null;
    status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
    duration: number;
    retry: number;
    steps: TimingStep[];
    /** TFP-155: which worker ran it (Playwright's parallelIndex), from which file, and when it started (ms). */
    worker?: number;
    file?: string;
    startedAt?: number;
}

export interface RawTiming {
    version: 1;
    tests: TimingTest[];
}

export function buildTimingReporterSource() {
    return `// TFP-211: each test's page loads, settle waits, requests and assertions, with their times (src/lib/run/timing.ts).
const { writeFileSync } = require('fs');

function kindOf(step) {
  if (step.category === 'expect') return { kind: 'expect', target: '' };
  if (step.category !== 'pw:api') return null;
  let match = /^Navigate to "(.*)"$/.exec(step.title);
  if (match) return { kind: match[1] === 'about:blank' ? 'blank' : 'goto', target: match[1] };
  if (/^Wait for load state "networkidle"$/.test(step.title)) return { kind: 'settle', target: '' };
  match = /^(GET|HEAD|POST|PUT|PATCH|DELETE|FETCH) "(.*)"$/.exec(step.title);
  if (match) return { kind: 'request', target: match[2] };
  return { kind: 'other', target: '' };
}

function inFixture(step) {
  for (let parent = step.parent; parent; parent = parent.parent) {
    if (parent.category === 'fixture' || parent.category === 'hook') return true;
  }
  return false;
}

class TestForgeTimingReporter {
  constructor() {
    this.steps = new Map();
    this.tests = [];
  }

  onStepEnd(test, result, step) {
    // Top-level calls only: an assertion's own retries, or a call inside a step, are counted once, in their parent.
    if (inFixture(step) || (step.parent && step.parent.category !== 'test.step')) return;
    const kind = kindOf(step);
    if (!kind) return;
    const key = test.id + ':' + result.retry;
    if (!this.steps.has(key)) this.steps.set(key, []);
    this.steps.get(key).push({ kind: kind.kind, target: kind.target, duration: step.duration, failed: Boolean(step.error) });
  }

  onTestEnd(test, result) {
    const key = test.id + ':' + result.retry;
    const page = test.annotations.find((annotation) => annotation.type === 'page');
    this.tests.push({
      titlePath: test.titlePath(),
      title: test.title,
      page: page && page.description ? page.description : null,
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      steps: this.steps.get(key) || [],
      // TFP-155: the worker, the unit's file and the start, so the run shows how its units were spread.
      worker: result.parallelIndex,
      file: require('path').basename(test.location.file),
      startedAt: result.startTime.getTime(),
    });
    this.steps.delete(key);
  }

  onEnd() {
    const file = process.env.${TIMING_FILE_ENV_VAR};
    if (file) writeFileSync(file, JSON.stringify({ version: 1, tests: this.tests }), 'utf8');
  }

  printsToStdio() {
    return false;
  }
}

module.exports = TestForgeTimingReporter;
`;
}

export type LinkCheck = "link health" | "linked routes" | "link tests" | "navigation links";

export interface RunTiming {
    tests: number;
    /** TFP-155: how many workers and unit files ran tests (absent in a record from before they were kept). */
    workers?: number;
    files?: number;
    /**
     * TFP-156 (Decision 9, Acceptance Criteria 5): the serial group's tests, when the run had one. `overlapping` counts
     * pairs of them that ran at the same time; the first starts at or after the last read-only test ends (ms epoch).
     */
    serialGroup?: { tests: number; overlapping: number; firstStart: number; lastReadOnlyEnd: number | null };
    /** The sum of the tests' own durations, in ms. */
    testMs: number;
    pageLoads: { count: number; ms: number };
    /** TFP-165's about:blank before a hash route: a load of its own. */
    blankLoads: { count: number; ms: number };
    settle: { count: number; ms: number; capped: number; cappedMs: number };
    requests: { count: number; ms: number };
    failing: {
        tests: number;
        ms: number;
        /** Time in the failing tests' steps that failed: assertions and calls waiting out their timeouts. */
        failedStepMs: number;
    };
    /**
     * Page loads by the page loaded and the area of the test that loaded it. A load is named as Playwright names
     * it, except the linked-routes check's, named from its route list ("(missing-route probe)" for the probe).
     * Playwright names any other load of an absolute address by its path alone, so on a hash-routed site such a
     * load can show as "/".
     */
    visits: { page: string; area: string; count: number }[];
    /** How many loads were named from the suite's route lists rather than Playwright's step names. */
    namedFromSuite: number;
    overlap: {
        /**
         * Each check's tests, loads, requests and time, and its distinct targets: link health's from its link list
         * and the linked-routes check's from its route list (the routes it loaded, in order), both in the suite's
         * source; a link test's and a navigation-link test's from inspection, by its link's name on its page.
         * Playwright names an absolute address by its path alone (no origin, no fragment), so the step names
         * can't tell a hash route or an external link apart; the suite's own lists can.
         */
        checks: { check: LinkCheck; tests: number; loads: number; requests: number; ms: number; targets: number }[];
        pairs: { checks: [LinkCheck, LinkCheck]; shared: number }[];
        /** Targets two or more of the checks reach. */
        sharedTargets: { target: string; checks: LinkCheck[] }[];
    };
    /** Each inspected page's controls by Decision 3's kinds; absent without page data. */
    controls?: PageControlKinds[];
}

const TEST_ID = /^TF[A-Z]+-\d+: /;

function checkOf(title: string): LinkCheck | null {
    const plain = title.replace(TEST_ID, "");
    if (/^link health: internal/.test(plain)) return "link health";
    if (/^link health: linked routes/.test(plain)) return "linked routes";
    if (/^link "/.test(plain) || /^cards linking to /.test(plain)) return "link tests";
    if (/^navigation link health: /.test(plain)) return "navigation links";
    return null;
}

/** A target as the run record names pages: path, query and fragment on the site's origin; anything else whole. */
export function targetOf(target: string, baseUrl: string | undefined) {
    try {
        const base = baseUrl ? new URL(baseUrl) : null;
        const url = new URL(target, base ?? undefined);
        if (base && url.origin === base.origin) return `${url.pathname}${url.search}${url.hash}`;
        return url.href;
    } catch {
        return target;
    }
}

/**
 * The link a test is about, by its title, on its page, from inspection: a navigation-link test's
 * ("navigation link health: Home", or "Untitled link to <url>") or a link test's (`link "Home" on /`, or
 * `link "Home" to /x on /`).
 */
function namedTarget(test: TimingTest, profile: ContentProfile | null): string | null {
    const plain = test.title.replace(TEST_ID, "");
    const linkTest = /^link "(.*)"(?: to (\S+))? on \S+: /.exec(plain);
    const name = linkTest ? linkTest[1] : plain.replace(/^navigation link health: /, "");
    const page = profile?.pages.find((candidate) => candidate.path === test.page) ?? null;
    const untitled = /^Untitled link to (.+)$/.exec(name);
    const links = page?.linkDetails ?? profile?.pages.flatMap((candidate) => candidate.linkDetails ?? []) ?? [];
    const link = untitled
        ? links.find((candidate) => candidate.url === untitled[1])
        : links.find((candidate) => (candidate.text || candidate.url) === name && (!linkTest?.[2] || candidate.rawHref === linkTest[2] || candidate.url === linkTest[2]));
    return link ? link.url : untitled ? untitled[1] : null;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function summarizeTiming(raw: RawTiming, options: { baseUrl?: string; profile?: ContentProfile | null; suiteCode?: string | null } = {}): RunTiming {
    // A retried test counts once: its last attempt, as the report does.
    const latest = new Map<string, TimingTest>();
    for (const test of raw.tests) {
        const key = test.titlePath.join("\u0000");
        const kept = latest.get(key);
        if (!kept || kept.retry <= test.retry) latest.set(key, test);
    }
    const tests = [...latest.values()];
    const steps = tests.flatMap((test) => test.steps);
    const of = (kind: TimingStepKind) => steps.filter((step) => step.kind === kind);
    const settles = of("settle");
    const failingTests = tests.filter((test) => test.status === "failed" || test.status === "timedOut");

    // The suite's own lists: link health's links and the linked-routes check's routes, by test title as Playwright
    // gives it (with its TFxx-NNN id, which tells apart one check's tests on different pages).
    const sources = new Map((options.suiteCode ? parseTestUnits(options.suiteCode) : []).map((unit) => [unit.id ? `${unit.id}: ${unit.title}` : unit.title, unit.source]));
    const listIn = (test: TimingTest, name: string): Array<Record<string, string>> | null => {
        const match = new RegExp(`const ${name} = (\\[.*?\\]);\\n`, "s").exec(sources.get(test.title) ?? "");
        try {
            return match ? (JSON.parse(match[1]) as Array<Record<string, string>>) : null;
        } catch {
            return null;
        }
    };

    // TFP-165's missing-route probe loads once per worker process, before its first linked route; Playwright starts
    // a fresh worker after a failed test. The tests are in the order they ran (one worker).
    const loadNames = new Map<TimingTest, string[]>();
    let probed = false;
    let namedFromSuite = 0;
    for (const test of tests) {
        const loads = test.steps.filter((step) => step.kind === "goto").map((step) => targetOf(step.target, options.baseUrl));
        const routes = checkOf(test.title) === "linked routes" ? listIn(test, "routes") : null;
        if (routes) {
            const names = [...(probed ? [] : ["(missing-route probe)"]), ...routes.map((route) => targetOf(route.url, options.baseUrl))];
            probed = true;
            namedFromSuite += Math.min(loads.length, names.length);
            loadNames.set(test, loads.map((load, index) => names[index] ?? load));
        } else {
            loadNames.set(test, loads);
        }
        if (test.status === "failed" || test.status === "timedOut") probed = false;
    }

    const visitCounts = new Map<string, { page: string; area: string; count: number }>();
    for (const test of tests) {
        const area = deriveArea(test.titlePath).key;
        for (const page of loadNames.get(test) ?? []) {
            const key = `${page}\u0000${area}`;
            const entry = visitCounts.get(key) ?? { page, area, count: 0 };
            entry.count++;
            visitCounts.set(key, entry);
        }
    }

    const targets = new Map<LinkCheck, Set<string>>();
    const effort = new Map<LinkCheck, { tests: number; loads: number; requests: number; ms: number }>();
    for (const test of tests) {
        const check = checkOf(test.title);
        if (!check) continue;
        const own = test.page ? targetOf(test.page, options.baseUrl) : null;
        const loads = loadNames.get(test) ?? [];
        let reached: string[];
        if (check === "link health") {
            const links = listIn(test, "links");
            // As the test does: internal, external and download links, less hash routes when it leaves them to the routes check.
            const skipsRoutes = (sources.get(test.title) ?? "").includes("TFP-165: a hash route");
            reached = links
                ? links.filter((link) => ["internal", "external", "download"].includes(link.linkType) && !(skipsRoutes && /^#!?\//.test(link.rawHref ?? ""))).map((link) => targetOf(link.url, options.baseUrl))
                : test.steps.filter((step) => step.kind === "request").map((step) => targetOf(step.target, options.baseUrl));
        } else if (check === "linked routes") {
            reached = loads.filter((load) => load !== "(missing-route probe)");
        } else {
            // A link test loads its target only when no other check does (TFP-205); a navigation-link test clicks it.
            const named = check === "navigation links" || loads.filter((load) => load !== own).length > 0 ? namedTarget(test, options.profile ?? null) : null;
            reached = named ? [targetOf(named, options.baseUrl)] : [];
        }
        const set = targets.get(check) ?? new Set<string>();
        for (const target of reached) if (target !== own && !target.includes("testforge-missing")) set.add(target);
        targets.set(check, set);
        const spent = effort.get(check) ?? { tests: 0, loads: 0, requests: 0, ms: 0 };
        spent.tests++;
        spent.loads += loads.length;
        spent.requests += test.steps.filter((step) => step.kind === "request").length;
        spent.ms += test.duration;
        effort.set(check, spent);
    }
    const checks = [...targets.keys()];
    const pairs: RunTiming["overlap"]["pairs"] = [];
    for (let left = 0; left < checks.length; left++) {
        for (let right = left + 1; right < checks.length; right++) {
            const other = targets.get(checks[right])!;
            pairs.push({ checks: [checks[left], checks[right]], shared: [...targets.get(checks[left])!].filter((target) => other.has(target)).length });
        }
    }
    const everyTarget = new Set(checks.flatMap((check) => [...targets.get(check)!]));
    const sharedTargets = [...everyTarget]
        .map((target) => ({ target, checks: checks.filter((check) => targets.get(check)!.has(target)) }))
        .filter((entry) => entry.checks.length > 1)
        .sort((left, right) => right.checks.length - left.checks.length || left.target.localeCompare(right.target));

    const spread = tests.some((test) => test.worker !== undefined)
        // A test skipped before it started has no worker (-1).
        ? { workers: new Set(tests.filter((test) => (test.worker ?? -1) >= 0).map((test) => test.worker)).size, files: new Set(tests.map((test) => test.file)).size }
        : {};
    // TFP-156: when the serial group ran, and whether any two of its tests (or one and a read-only test) overlapped.
    const timed = tests.filter((test): test is TimingTest & { startedAt: number } => test.startedAt !== undefined);
    const serial = timed.filter((test) => test.file === SERIAL_UNIT);
    const readOnly = timed.filter((test) => test.file !== SERIAL_UNIT && test.status !== "skipped");
    const serialGroup = serial.length > 0
        ? {
            serialGroup: {
                tests: serial.length,
                overlapping: serial.flatMap((one, index) => serial.slice(index + 1).filter((other) => one.startedAt < other.startedAt + other.duration && other.startedAt < one.startedAt + one.duration)).length,
                firstStart: Math.min(...serial.map((test) => test.startedAt)),
                lastReadOnlyEnd: readOnly.length > 0 ? Math.max(...readOnly.map((test) => test.startedAt + test.duration)) : null,
            },
        }
        : {};
    return {
        tests: tests.length,
        ...spread,
        ...serialGroup,
        testMs: sum(tests.map((test) => test.duration)),
        pageLoads: { count: of("goto").length, ms: sum(of("goto").map((step) => step.duration)) },
        blankLoads: { count: of("blank").length, ms: sum(of("blank").map((step) => step.duration)) },
        settle: {
            count: settles.length,
            ms: sum(settles.map((step) => step.duration)),
            capped: settles.filter((step) => step.failed).length,
            cappedMs: sum(settles.filter((step) => step.failed).map((step) => step.duration)),
        },
        requests: { count: of("request").length, ms: sum(of("request").map((step) => step.duration)) },
        failing: {
            tests: failingTests.length,
            ms: sum(failingTests.map((test) => test.duration)),
            failedStepMs: sum(failingTests.flatMap((test) => test.steps.filter((step) => step.failed && step.kind !== "settle").map((step) => step.duration))),
        },
        visits: [...visitCounts.values()].sort((left, right) => left.page.localeCompare(right.page) || left.area.localeCompare(right.area)),
        namedFromSuite,
        overlap: {
            checks: checks.map((check) => ({ check, ...effort.get(check)!, targets: targets.get(check)!.size })),
            pairs,
            sharedTargets,
        },
    };
}

export type ControlKind = "in place" | "in-app navigation" | "path navigation" | "unclear";

export interface PageControlKinds {
    page: string;
    counts: Record<ControlKind, number>;
}

/**
 * Decision 3's kinds, as far as inspection can tell them:
 * - in place: a radio, checkbox, switch, tab or toggle (by role or aria-checked/pressed/selected), a disclosure
 *   (aria-expanded), an in-page anchor link;
 * - in-app navigation: a link to a hash route (#/contact), which a single-page app draws without a load;
 * - path navigation: a same-origin link to another path. In-app on a single-page app with path routing, a full
 *   load on a multi-page site; inspection doesn't tell the two apart;
 * - unclear: anything else (other buttons, fields, lists, forms, external and download links).
 * Each link is counted once, from linkDetails; actionable elements that are links are skipped.
 */
export function countControlKinds(profile: ContentProfile | null, paths?: string[]): PageControlKinds[] {
    const wanted = paths ? new Set(paths) : null;
    const IN_PLACE_ROLES = new Set(["radio", "checkbox", "switch", "tab", "menuitemcheckbox", "menuitemradio", "option"]);
    const linkKind = (link: LinkDetail): ControlKind => {
        if (link.linkType === "anchor") return "in place";
        if (isRouteLink(link)) return "in-app navigation";
        if (link.linkType === "internal") return "path navigation";
        return "unclear";
    };
    return (profile?.pages ?? [])
        .filter((page) => !wanted || wanted.has(page.path))
        .map((page) => {
            const counts: Record<ControlKind, number> = { "in place": 0, "in-app navigation": 0, "path navigation": 0, unclear: 0 };
            for (const link of page.linkDetails ?? []) counts[linkKind(link)]++;
            for (const element of page.actionableElements ?? []) {
                if (element.elementType === "link") continue;
                const role = element.locator?.role ?? "";
                const inPlace = IN_PLACE_ROLES.has(role) || element.ariaChecked !== null || element.ariaPressed !== null || element.ariaSelected !== null || element.ariaExpanded !== null;
                counts[inPlace ? "in place" : "unclear"]++;
            }
            return { page: page.path, counts };
        });
}

/** The run record's timing: the reporter's file summarized, with the inspected pages' controls. Null when the file is missing or unreadable. */
export async function readRunTiming(file: string, baseUrl: string | undefined, profile: ContentProfile | null, suiteCode: string | null = null): Promise<RunTiming | null> {
    const text = await readFile(file, "utf8").catch(() => "");
    if (!text) return null;
    try {
        const raw = JSON.parse(text) as RawTiming;
        if (raw.version !== 1 || !Array.isArray(raw.tests)) return null;
        return { ...summarizeTiming(raw, { baseUrl, profile, suiteCode }), ...(profile ? { controls: countControlKinds(profile) } : {}) };
    } catch {
        return null;
    }
}
