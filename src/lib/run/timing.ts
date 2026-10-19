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
 * selected page's controls by Decision 3's kinds, from the inspection, as data for Emil's later look.
 */
import { deriveArea } from "@/lib/report/execution";
import type { ContentProfile, LinkDetail } from "@/lib/generate/mock/types";
import { isRouteLink } from "@/lib/generate/mock/link-audits/routes";
import { readFile } from "fs/promises";

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
    /** Page loads by the page loaded and the area of the test that loaded it. */
    visits: { page: string; area: string; count: number }[];
    overlap: {
        /** Each check's distinct targets: loaded, requested or (navigation links) named by inspection. */
        checks: { check: LinkCheck; targets: number }[];
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

/** The link a navigation-link test clicks, by its title, on its page: "Home", or "Untitled link to <url>". */
function navigationTarget(test: TimingTest, profile: ContentProfile | null): string | null {
    const name = test.title.replace(TEST_ID, "").replace(/^navigation link health: /, "");
    const page = profile?.pages.find((candidate) => candidate.path === test.page) ?? null;
    const untitled = /^Untitled link to (.+)$/.exec(name);
    const links = page?.linkDetails ?? profile?.pages.flatMap((candidate) => candidate.linkDetails ?? []) ?? [];
    const link = untitled ? links.find((candidate) => candidate.url === untitled[1]) : links.find((candidate) => candidate.text === name);
    return link ? link.url : untitled ? untitled[1] : null;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function summarizeTiming(raw: RawTiming, options: { baseUrl?: string; profile?: ContentProfile | null } = {}): RunTiming {
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

    const visitCounts = new Map<string, { page: string; area: string; count: number }>();
    for (const test of tests) {
        const area = deriveArea(test.titlePath).key;
        for (const step of test.steps.filter((candidate) => candidate.kind === "goto")) {
            const page = targetOf(step.target, options.baseUrl);
            const key = `${page}\u0000${area}`;
            const entry = visitCounts.get(key) ?? { page, area, count: 0 };
            entry.count++;
            visitCounts.set(key, entry);
        }
    }

    const targets = new Map<LinkCheck, Set<string>>();
    for (const test of tests) {
        const check = checkOf(test.title);
        if (!check) continue;
        const own = test.page ? targetOf(test.page, options.baseUrl) : null;
        const reached = test.steps
            .filter((step) => step.kind === "goto" || step.kind === "request")
            .map((step) => targetOf(step.target, options.baseUrl))
            .filter((target) => target !== own && !target.includes("testforge-missing"));
        if (check === "navigation links") {
            const named = navigationTarget(test, options.profile ?? null);
            if (named) reached.push(targetOf(named, options.baseUrl));
        }
        const set = targets.get(check) ?? new Set<string>();
        for (const target of reached) set.add(target);
        targets.set(check, set);
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

    return {
        tests: tests.length,
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
        overlap: {
            checks: checks.map((check) => ({ check, targets: targets.get(check)!.size })),
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
export async function readRunTiming(file: string, baseUrl: string | undefined, profile: ContentProfile | null): Promise<RunTiming | null> {
    const text = await readFile(file, "utf8").catch(() => "");
    if (!text) return null;
    try {
        const raw = JSON.parse(text) as RawTiming;
        if (raw.version !== 1 || !Array.isArray(raw.tests)) return null;
        return { ...summarizeTiming(raw, { baseUrl, profile }), ...(profile ? { controls: countControlKinds(profile) } : {}) };
    } catch {
        return null;
    }
}
