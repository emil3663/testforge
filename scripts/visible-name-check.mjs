// Phase 48 (TFP-279), Acceptance Criteria 5: what a person sees from Mr Onion says Mr Onion. It reads each surface -
// the built app's page, the JavaScript and manifest that page loads, its health answer; each run's exported report and
// junit.xml; the CLI's help and error output - and lists every "testforge", in any case, that isn't on the allowlist
// below. Exit 0 only when there is none, and the page title, Open Graph site name and JUnit suite name say Mr Onion.
//
//   node scripts/visible-name-check.mjs --app http://127.0.0.1:3100 --out <run folder> [--out ...] [--own-path <folder> ...]
//
// The app must be running (a built `next start`); each --out is a `mr-onion run --out` folder. The target's own
// content would also show up here (the fixture and Toolshop have none). The run's own --out folder, this checkout's
// folder and each --own-path (a --data-dir the run was given, say) are set aside: a report names where it saved things,
// and those are the user's paths, not the product's name.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * What the app's own JavaScript may carry: the compatibility code, as the bundler writes it, and nothing more. A
 * pattern this narrow can't hide the old name in a component's text.
 */
const ALLOWED_IN_SCRIPTS = [
    { pattern: /\.includes\("TESTFORGE_INTERACTIVE"\)/g, why: "the UI's interactive switch, for a suite saved by 0.2.0 (Decision 8)" },
    { pattern: /\?"TestForge":"Mr Onion"/g, why: "the footer rule: the old name for a run below 0.3.0 (Decision 7)" },
    { pattern: /"TestForge version not recorded"/g, why: "the footer of a run from before the version stamp (Decision 7)" },
];
/** In a report of a run stamped below 0.3.0: its footer, and only its footer, names the old product (Decision 7). */
const ALLOWED_IN_OLD_REPORT = [{ pattern: /<footer[^>]*>TestForge \d+\.\d+\.\d+/g, why: "the footer of a run below 0.3.0" }];

function args(argv) {
    const out = [];
    const own = [];
    const logs = [];
    let app = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--app") app = argv[++i];
        else if (argv[i] === "--out") out.push(argv[++i]);
        else if (argv[i] === "--own-path") own.push(argv[++i]);
        else if (argv[i] === "--log") logs.push(argv[++i]);
        else throw new Error(`unknown argument ${argv[i]}`);
    }
    if (!app || out.length === 0) throw new Error("usage: node scripts/visible-name-check.mjs --app <url> --out <run folder> [--out ...] [--own-path <folder> ...] [--log <a run's stdout or stderr> ...]");
    return { app, out, own, logs };
}

/** Every "testforge" in `text`, with its surroundings, less the ones `allowed` accepts. */
function hits(source, text, allowed = () => false) {
    const found = [];
    for (const match of text.matchAll(/testforge/gi)) {
        const around = text.slice(Math.max(0, match.index - 40), match.index + 50).replace(/\s+/g, " ");
        if (!allowed(text, match.index)) found.push(`${source}: ...${around}...`);
    }
    return found;
}

/** A hit at `index` is allowed when it falls inside a match of one of the allowed patterns. */
const inAllowed = (list) => (text, index) =>
    list.some(({ pattern }) => [...text.matchAll(new RegExp(pattern.source, "g"))].some((match) => index >= match.index && index < match.index + match[0].length));

async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
}

const { app, out, own, logs } = args(process.argv.slice(2));
/** The user's own paths - each --out folder, this checkout, each --own-path - set aside wherever they appear. */
const ownPaths = (text) =>
    [...out, ROOT, ...own].map((path) => resolve(path)).flatMap((path) => [path, path.replace(/\\/g, "/")]).reduce((rest, path) => rest.split(path).join("<own path>"), text);
const problems = [];
const checked = [];

// The app: its page, the scripts and styles it loads, its manifest and health answer.
const page = await fetchText(`${app}/`);
const title = page.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
const siteName = page.match(/<meta property="og:site_name" content="([^"]*)"/)?.[1] ?? "";
if (!/Mr Onion/.test(title)) problems.push(`the page title is "${title}"`);
if (siteName !== "Mr Onion") problems.push(`og:site_name is "${siteName}"`);
problems.push(...hits("app page", page));
const assets = [...new Set([...page.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]))];
let allowedInScripts = 0;
for (const asset of assets) {
    const text = await fetchText(`${app}${asset}`);
    allowedInScripts += (text.match(/testforge/gi) ?? []).length;
    const found = hits(`app ${asset}`, text, inAllowed(ALLOWED_IN_SCRIPTS));
    allowedInScripts -= found.length;
    problems.push(...found);
}
problems.push(...hits("app manifest", await fetchText(`${app}/manifest.webmanifest`)));
problems.push(...hits("app /api/health", await fetchText(`${app}/api/health`)));
// The API's refusal, as a page on another site would get it.
const refused = await fetch(`${app}/api/health`, { headers: { origin: "http://elsewhere.example" } });
problems.push(...hits(`app refusal (HTTP ${refused.status})`, await refused.text()));
checked.push(`app: the page, ${assets.length} scripts and styles (${allowedInScripts} allowed compatibility strings), the manifest, /api/health and its refusal (HTTP ${refused.status}); title "${title}", og:site_name "${siteName}"`);

// Each run: its exported report and its junit.xml, the JUnit counts against report.json's.
for (const folder of out) {
    const report = JSON.parse(readFileSync(join(folder, "report.json"), "utf8"));
    const version = report.producedBy?.version ?? "";
    const beforeRename = /^0\.[0-2]\./.test(version);
    const html = ownPaths(readFileSync(join(folder, "report.html"), "utf8"));
    problems.push(...hits(`${folder} report.html`, html, beforeRename ? inAllowed(ALLOWED_IN_OLD_REPORT) : () => false));
    const junit = ownPaths(readFileSync(join(folder, "junit.xml"), "utf8"));
    problems.push(...hits(`${folder} junit.xml`, junit));
    const suites = junit.match(/<testsuites name="([^"]*)" tests="(\d+)" failures="(\d+)" errors="(\d+)" skipped="(\d+)"/);
    const summary = report.report?.summary;
    if (!suites) problems.push(`${folder} junit.xml: no <testsuites> line`);
    if (!summary) problems.push(`${folder} report.json: no summary to count against`);
    if (suites && suites[1] !== "Mr Onion") problems.push(`${folder} junit.xml: <testsuites name="${suites[1]}">`);
    if (suites && summary) {
        const junitCounts = suites.slice(2, 6).map(Number);
        const reportCounts = [summary.planned, summary.failed, summary.blocked, summary.notRun];
        if (junitCounts.join() !== reportCounts.join()) problems.push(`${folder}: junit.xml tests/failures/errors/skipped ${junitCounts.join("/")}; report.json planned/failed/blocked/not run ${reportCounts.join("/")}`);
    }
    checked.push(`${folder}: report.html (${report.report?.comprehensive ? "Comprehensive" : "Standard"}, version ${version}), junit.xml <testsuites name="${suites?.[1]}" tests="${suites?.[2]}" failures="${suites?.[3]}">`);
}

// Each run's own output, as the command printed it.
for (const log of logs) {
    problems.push(...hits(log, ownPaths(readFileSync(log, "utf8"))));
    checked.push(`${log}: a run's output`);
}

// The CLI: its help and its error output, from the command as installed; the last, a run that can't reach its site.
const unreachable = join(ROOT, "comparisons", "visible-name-unreachable");
for (const cliArgs of [["--help"], ["run", "--help"], ["run", "--no-such-flag"], ["run"], ["nope"], ["run", "--url", "http://127.0.0.1:9", "--out", unreachable]]) {
    const result = spawnSync(process.execPath, [join(ROOT, "bin", "mr-onion.mjs"), ...cliArgs], { encoding: "utf8", timeout: 120_000 });
    problems.push(...hits(`mr-onion ${cliArgs.slice(0, 3).join(" ")} (exit ${result.status})`, ownPaths(`${result.stdout}\n${result.stderr}`)));
    checked.push(`mr-onion ${cliArgs.join(" ")}: exit ${result.status}`);
}

for (const line of checked) console.log(`checked ${line}`);
if (problems.length === 0) {
    console.log("visible-name: no old name found");
    process.exit(0);
}
console.log(`visible-name: ${problems.length} found`);
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
