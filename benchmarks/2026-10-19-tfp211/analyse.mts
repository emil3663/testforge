// TFP-211: each site's and suite's three runs side by side, with each number's spread (min, median, max).
// Each run is summarized again from its raw timing (runs/<label>-<kind>-run<n>-timing.json) with the suite and,
// for Standard, the inspection (summarizeTiming at the commit this runs on), so every run is read by the same
// code, whatever measure.mts's own -summary.json was written with. Prints Markdown tables for the report.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-19-tfp211/analyse.mts > benchmarks/2026-10-19-tfp211/analysis.md
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { countControlKinds, summarizeTiming } = await import(pathToFileURL(join(process.cwd(), "src/lib/run/timing.ts")).href);

const R = "benchmarks/2026-10-19-tfp211/runs";
const LABELS = ["fixture", "with-bugs", "clean"];
const KINDS = ["standard", "security", "accessibility"];
type Summary = {
    runMs: number; tests: number; testMs: number;
    pageLoads: { count: number; ms: number }; blankLoads: { count: number; ms: number };
    settle: { count: number; ms: number; capped: number; cappedMs: number };
    requests: { count: number; ms: number };
    failing: { tests: number; ms: number; failedStepMs: number };
    visits: { page: string; area: string; count: number }[];
    namedFromSuite: number;
    overlap: { checks: { check: string; tests: number; loads: number; requests: number; ms: number; targets: number }[]; pairs: { checks: [string, string]; shared: number }[]; sharedTargets: { target: string; checks: string[] }[] };
    controls?: { page: string; counts: Record<string, number> }[];
};
type Records = { site: string; runSeconds: number; byStatus: Record<string, number>; records: { title: string; status: string }[] };

const read = <T,>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);
const s = (ms: number) => Math.round(ms / 1000);
const spread = (values: number[]) => {
    if (values.length === 0) return "-";
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return sorted[0] === sorted.at(-1) ? `${median}` : `${median} (${sorted[0]} to ${sorted.at(-1)})`;
};

const out: string[] = [];
out.push("# TFP-211: the numbers", "", "Each cell: the median of the three runs, then (min to max) when they differ. Times in seconds.", "");
for (const label of LABELS) {
    for (const kind of KINDS) {
        const suiteFile = join(R, `${label}-${kind}-suite.spec.ts`);
        const suiteCode = existsSync(suiteFile) ? readFileSync(suiteFile, "utf8") : null;
        const profile = kind === "standard" ? read<object>(join(R, `${label}-standard-profile.json`)) : null;
        const runs = [1, 2, 3]
            .map((run) => {
                const records = read<Records>(join(R, `${label}-${kind}-run${run}-records.json`));
                const raw = read<object>(join(R, `${label}-${kind}-run${run}-timing.json`));
                if (!records || !raw) return { run, records, summary: null };
                const summary = { runMs: records.runSeconds * 1000, ...summarizeTiming(raw, { baseUrl: records.site, profile, suiteCode }), ...(profile ? { controls: countControlKinds(profile) } : {}) } as Summary;
                return { run, records, summary };
            })
            .filter((entry) => entry.summary);
        if (runs.length === 0) continue;
        const col = (pick: (summary: Summary) => number) => spread(runs.map((entry) => pick(entry.summary!)));
        out.push(`## ${label}, ${kind} (${runs.length} runs)`, "");
        out.push("| Number | Value |", "| --- | --- |");
        out.push(`| Run time | ${col((x) => s(x.runMs))} |`);
        out.push(`| Tests | ${col((x) => x.tests)} |`);
        out.push(`| Test time (sum) | ${col((x) => s(x.testMs))} |`);
        out.push(`| Page loads: count | ${col((x) => x.pageLoads.count)} |`);
        out.push(`| Page loads: time | ${col((x) => s(x.pageLoads.ms))} |`);
        out.push(`| about:blank loads: count, time | ${col((x) => x.blankLoads.count)}; ${col((x) => s(x.blankLoads.ms))} |`);
        out.push(`| Settle waits: count | ${col((x) => x.settle.count)} |`);
        out.push(`| Settle waits: time | ${col((x) => s(x.settle.ms))} |`);
        out.push(`| Settle waits at the 5 s cap: count, time | ${col((x) => x.settle.capped)}; ${col((x) => s(x.settle.cappedMs))} |`);
        out.push(`| Requests: count, time | ${col((x) => x.requests.count)}; ${col((x) => s(x.requests.ms))} |`);
        out.push(`| Failing tests: count | ${col((x) => x.failing.tests)} |`);
        out.push(`| Failing tests: time | ${col((x) => s(x.failing.ms))} |`);
        out.push(`| Failing tests: time in failed steps | ${col((x) => s(x.failing.failedStepMs))} |`);
        const pages = new Set(runs[0].summary!.visits.map((visit) => visit.page));
        out.push(`| Pages loaded (distinct) | ${col((x) => new Set(x.visits.map((visit) => visit.page)).size)} |`);
        out.push(`| Loads per distinct page | ${col((x) => Math.round((x.pageLoads.count / Math.max(1, new Set(x.visits.map((visit) => visit.page)).size)) * 10) / 10)} |`);
        // Failure sets: the same tests failing in every run?
        const failed = runs.map((entry) => new Set((entry.records?.records ?? []).filter((record) => record.status === "Failed").map((record) => record.title)));
        const always = [...failed[0]].filter((title) => failed.every((set) => set.has(title)));
        const sometimes = new Set(failed.flatMap((set) => [...set]).filter((title) => !always.includes(title)));
        out.push(`| Failures in every run / in some runs only | ${always.length} / ${sometimes.size} |`, "");
        if (sometimes.size > 0) out.push("Failing in some runs only:", ...[...sometimes].map((title) => `- ${title} (${failed.map((set, index) => (set.has(title) ? `run ${runs[index].run}` : "")).filter(Boolean).join(", ")})`), "");
        // Visits by area, per page (run 1).
        if (kind === "standard") {
            const first = runs[0].summary!;
            const areas = [...new Set(first.visits.map((visit) => visit.area))].sort();
            out.push(`Page loads by page and area (run 1, ${pages.size} pages):`, "", `| Page | ${areas.join(" | ")} | All |`, `| --- | ${areas.map(() => "---").join(" | ")} | --- |`);
            for (const page of [...pages].sort()) {
                const counts = areas.map((area) => first.visits.find((visit) => visit.page === page && visit.area === area)?.count ?? 0);
                out.push(`| ${page} | ${counts.join(" | ")} | ${counts.reduce((a, b) => a + b, 0)} |`);
            }
            out.push("", `Loads named from the suite's route lists (run 1): ${first.namedFromSuite} of ${first.pageLoads.count}.`, "");
            out.push("The link checks (run 1):", "", "| Check | Tests | Loads | Requests | Time (s) | Distinct targets |", "| --- | --- | --- | --- | --- | --- |", ...first.overlap.checks.map((check) => `| ${check.check} | ${check.tests} | ${check.loads} | ${check.requests} | ${s(check.ms)} | ${check.targets} |`), "");
            out.push("The link checks' time, every run:", "", "| Check | Time (s) |", "| --- | --- |", ...first.overlap.checks.map((check) => `| ${check.check} | ${spread(runs.map((entry) => s(entry.summary!.overlap.checks.find((other) => other.check === check.check)?.ms ?? 0)))} |`), "");
            out.push("| Checks | Targets shared |", "| --- | --- |", ...first.overlap.pairs.map((pair) => `| ${pair.checks.join(" and ")} | ${pair.shared} |`), "");
            out.push(`Targets reached by two or more checks: ${first.overlap.sharedTargets.length}${first.overlap.sharedTargets.length ? ` (${first.overlap.sharedTargets.map((entry) => `${entry.target}: ${entry.checks.join(", ")}`).join("; ")})` : ""}.`, "");
            if (first.controls) {
                out.push("Controls by Decision 3's kinds (inspection):", "", "| Page | In place | In-app navigation | Path navigation | Unclear |", "| --- | --- | --- | --- | --- |");
                for (const page of first.controls) out.push(`| ${page.page} | ${page.counts["in place"]} | ${page.counts["in-app navigation"]} | ${page.counts["path navigation"]} | ${page.counts.unclear} |`);
                out.push("");
            }
        }
    }
}
console.log(out.join("\n"));
