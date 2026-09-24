// Phase 21 (TFP-099): turn one or more compare-generators results into a
// markdown report scoring Decision 4's four dimensions per case - or stating,
// per case, why a dimension can't be scored. Never a guessed number.
//
//   node scripts/comparison-report.mjs comparisons/<dir>[#case,case] [...] > report.md
//
// A #case,case suffix keeps only those cases from that run, so a report can
// take each case from its valid run (e.g. after a fixture fix) without
// mixing in a superseded one.
//
// Dimensions:
//   Coverage     - Phase 17's discovered-surface coverage per area, as the run
//                  report computes it, AND a title-independent proxy: how many
//                  discovered page elements the suite's code refers to by name.
//                  The first credits a test only when its title matches the
//                  template generator's naming, so it cannot credit a
//                  model-written test; it is shown, labelled, not hidden.
//   Pass/fail    - per area, because the two generators never share test
//                  titles, so title-level agreement (Phase 17's diff) would
//                  report every test as "only in one run".
//   Defect       - a generator detects an injected defect when at least one of
//                  its tests passes on the clean site and fails with the
//                  defect on. Only the comparison fixture has defects.
//   Latency/cost - generation and run wall time; cost is $0 for both here.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
    console.error("usage: node scripts/comparison-report.mjs <comparisons/dir> [...]");
    process.exit(2);
}

const PASS = new Set(["Passed", "Flaky"]);
// A skipped test (test.skip, reported as Blocked) neither passed nor failed.
const SKIPPED = "Blocked";
const secs = (ms) => (ms == null ? "n/a" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Names a suite could use to refer to a discovered element. */
function elementNames(profile) {
    const names = [];
    for (const page of profile.pages ?? []) {
        for (const el of page.actionableElements ?? []) {
            const candidates = [el.locator?.name, el.text, el.locator?.label, el.locator?.placeholder]
                .filter((s) => typeof s === "string")
                .map((s) => s.trim())
                .filter((s) => s.length >= 2 && s.length <= 60);
            if (candidates.length > 0) names.push({ key: `${el.elementType} ${candidates[0]}`, candidates });
        }
    }
    const seen = new Set();
    return names.filter((n) => (seen.has(n.key) ? false : (seen.add(n.key), true)));
}

function referenced(code, names) {
    return names.filter((n) => n.candidates.some((c) => code.includes(`'${c}'`) || code.includes(`"${c}"`))).length;
}

function byArea(execution) {
    const areas = {};
    for (const e of execution ?? []) {
        const a = (areas[e.area] ??= { total: 0, passed: 0, skipped: 0 });
        if (e.status === SKIPPED) {
            a.skipped += 1;
            continue;
        }
        a.total += 1;
        if (PASS.has(e.status)) a.passed += 1;
    }
    return areas;
}

function detection(g) {
    if (!g?.clean || !g?.defect) return null;
    if (g.clean.execution.length === 0) return "empty";
    const cleanPass = new Set(g.clean.execution.filter((e) => PASS.has(e.status)).map((e) => e.title));
    return g.defect.execution.filter((e) => cleanPass.has(e.title) && !PASS.has(e.status)).map((e) => e.title);
}

const out = [];
const w = (s = "") => out.push(s);

for (const spec of dirs) {
    const [dir, pick] = spec.split("#");
    const keep = pick ? new Set(pick.split(",")) : null;
    const data = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
    if (keep) data.results = data.results.filter((r) => keep.has(r.case.name));
    const profilePath = join(dir, "content-profile.json");
    const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : { pages: [] };
    const names = elementNames(profile);

    w(`## ${data.config.name}: ${data.config.target}${keep ? ` (cases: ${[...keep].join(", ")})` : ""}`);
    w();
    w(`Local model \`${data.model}\`, TestForge ${data.server}, finished ${data.finishedAt ?? "(incomplete)"}. Source: \`${dir}\`.`);
    w(`Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): ${names.length}.`);
    w();

    for (const r of data.results) {
        const c = r.case;
        const det = r.generators.deterministic;
        const loc = r.generators.local;
        w(`### ${c.name}`);
        w();
        w(`Request: "${c.description}" - areas: ${(c.practices ?? []).join(", ") || "inferred"}${c.defect ? ` - injected defect: \`${c.defect}\`` : ""}.`);
        w();
        w("| | Deterministic | Local |");
        w("| --- | --- | --- |");
        w(`| Generation | ${secs(det?.generation.ms)} | ${secs(loc?.generation.ms)} (${loc?.generation.generatedBy}${loc?.generation.fallbackReason ? "/" + loc.generation.fallbackReason : ""}) |`);
        if (loc?.skipped) {
            w(`| Runs | ${secs(det?.clean?.ms)} | not run: ${loc.skipped} |`);
            w();
            continue;
        }
        const codeOf = (gen) => {
            const p = join(dir, `${c.name}.${gen}.spec.ts`);
            return existsSync(p) ? readFileSync(p, "utf8") : "";
        };
        const runCell = (g, gen) =>
            g.clean.summary
                ? `${secs(g.clean.ms)}, ${g.clean.summary.passed}/${g.clean.summary.executed} passed`
                : `no report (run ${g.clean.runStatus}); the suite has ${(codeOf(gen).match(/\btest\(/g) ?? []).length} test(s)`;
        w(`| Clean run | ${runCell(det, "deterministic")} | ${runCell(loc, "local")} |`);
        w(`| Cost | $0 (no model) | $0 (local, no API) |`);
        const cov = (g) => (g.clean.coverage?.matrix ?? []).map((m) => `${m.requirement} ${m.percentage}%`).join(", ") || "n/a";
        w(`| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | ${cov(det)} | ${cov(loc)} |`);
        w(`| Discovered elements referenced in the suite (title-independent proxy) | ${referenced(codeOf("deterministic"), names)}/${names.length} | ${referenced(codeOf("local"), names)}/${names.length} |`);
        const aDet = byArea(det.clean.execution);
        const aLoc = byArea(loc.clean.execution);
        const areas = [...new Set([...Object.keys(aDet), ...Object.keys(aLoc)])];
        const cell = (x, a) => (x[a] ? `${a} ${x[a].passed}/${x[a].total}${x[a].skipped ? ` (+${x[a].skipped} skipped)` : ""}` : `${a} -`);
        w(`| Pass/fail by area (clean) | ${areas.map((a) => cell(aDet, a)).join(", ")} | ${areas.map((a) => cell(aLoc, a)).join(", ")} |`);
        const agree = areas.map((a) => {
            if (!aDet[a] || !aLoc[a]) return `${a}: only one generator tested it`;
            const dAll = aDet[a].passed === aDet[a].total;
            const lAll = aLoc[a].passed === aLoc[a].total;
            return `${a}: ${dAll === lAll ? "agree" : "disagree"} (${dAll ? "all pass" : "failures"} vs ${lAll ? "all pass" : "failures"})`;
        });
        w(`| Pass/fail agreement | ${agree.join("; ")} | |`);
        if (c.defect) {
            const dDet = detection(det);
            const dLoc = detection(loc);
            const show = (list) => (list === null ? "not run" : list === "empty" ? "nothing to detect with: the suite has no tests" : list.length > 0 ? `**detected** by ${list.length} test(s): ${list.slice(0, 3).map((t) => `"${t}"`).join(", ")}` : "not detected");
            w(`| Defect detection (\`${c.defect}\`) | ${show(dDet)} | ${show(dLoc)} |`);
        } else {
            w(`| Defect detection | skipped: no injected defect for this case${data.config.fixtureControl ? "" : " (not the comparison fixture)"} | same |`);
        }
        const failures = loc.clean.execution.filter((e) => !PASS.has(e.status) && e.status !== SKIPPED);
        if (failures.length > 0) {
            w();
            w(`Local clean-run failures: ${failures.map((f) => `"${f.title}" (${f.rawMessage.split("\n")[0].slice(0, 140)})`).join("; ")}`);
        }
        if (r.diff) {
            w();
            const titlesDet = new Set(det.clean.execution.map((e) => e.title));
            const shared = loc.clean.execution.filter((e) => titlesDet.has(e.title)).length;
            w(`Phase 17 diff: ${r.diff.testsPassedInAOnly.length} test(s) pass only in the deterministic run and ${r.diff.testsPassedInBOnly.length} only in the local run; the suites share ${shared} test title(s)${shared === 0 ? ", so this lists each passing suite whole rather than any disagreement" : ""}.`);
        }
        w();
    }
}

console.log(out.join("\n"));
