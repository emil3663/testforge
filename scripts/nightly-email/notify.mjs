// TFP-217: what nightly.yml's steps run. Each job passes on what it found as an output, and the notify job builds the
// summary from them and sends it.
//
//   node scripts/nightly-email/notify.mjs unit <unit.log>          prints `summary=<json>` for $GITHUB_OUTPUT
//   node scripts/nightly-email/notify.mjs template <template.log>  prints `line=<the check's line>`
//   node scripts/nightly-email/notify.mjs build <message.json>     writes the message and the run page's summary
//   node scripts/nightly-email/notify.mjs send <message.json>      sends it
//   node scripts/nightly-email/notify.mjs issue                    opens, updates or closes the failure issue (TFP-252),
//                                                                  printing `action=` and `url=` for $GITHUB_OUTPUT
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { failureReport, issueTitle, planIssue } from "./issue.mjs";
import { sendSummary } from "./send.mjs";
import { buildSummary, nightlyPassed, parseTemplateLine, parseUnitLog } from "./summary.mjs";

const [command, file] = process.argv.slice(2);
const logText = () => (existsSync(file) ? readFileSync(file, "utf8") : "");
const today = () => new Date().toISOString().slice(0, 10);

function readNeeds() {
    const needs = JSON.parse(process.env.NEEDS);
    const output = (job, name) => needs[job]?.outputs?.[name] || null;
    const jobs = Object.fromEntries(Object.entries(needs).map(([job, { result }]) => [job, result]));
    return { output, jobs, unit: JSON.parse(output("unit", "summary") ?? "null") };
}

function build() {
    const { output, jobs, unit } = readNeeds();
    const run = { url: process.env.RUN_URL, trigger: process.env.TRIGGER, commit: process.env.COMMIT, base: process.env.TEMPLATE_BASE, date: today() };
    const issue = output("issue", "action") ? { action: output("issue", "action"), url: output("issue", "url") } : null;
    const message = buildSummary({ jobs, unit, templateLine: output("template-unchanged", "line"), run, issue });
    writeFileSync(file, JSON.stringify(message), "utf8");
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${message.subject}\n\n~~~~text\n${message.body}\n~~~~\n`, "utf8");
    console.log(message.subject);
}

async function send() {
    const message = JSON.parse(readFileSync(file, "utf8"));
    // Only the send needs it: a failed install must still leave the summary on the run's page.
    const { default: nodemailer } = await import("nodemailer");
    const info = await sendSummary({ message, password: process.env.TESTFORGE_SMTP_PASSWORD, to: process.env.CI_REPORT_TO, createTransport: nodemailer.createTransport });
    console.log(`sent: "${message.subject}"; accepted ${info.accepted.length}, rejected ${info.rejected.length}; ${info.response}`);
}

// The body goes in on stdin, so nothing in it is read as an argument. NIGHTLY_GH_SCRIPT, for issue.test.mjs only: a
// node script that plays gh, so the open, comment and close sequence can be run without touching GitHub.
// A failed call's error carries gh's own last line ("HTTP 404" and the like), which also goes to the log.
const gh = (args, input) => {
    const [file, prefix] = process.env.NIGHTLY_GH_SCRIPT ? [process.execPath, [process.env.NIGHTLY_GH_SCRIPT]] : ["gh", []];
    try {
        return execFileSync(file, [...prefix, ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch (error) {
        const said = String(error.stderr ?? "").trim();
        if (said) process.stderr.write(`${said}\n`);
        throw new Error(`gh ${args.slice(0, 2).join(" ")}: ${said.split("\n").filter(Boolean).at(-1) ?? error.message}`);
    }
};
const ghJson = (args) => JSON.parse(gh(args));

/**
 * The last green run of this workflow on the branch, and the commits from it to this one; null if none was green.
 * Either lookup failing is said in the issue, never a reason not to open it.
 */
function rangeSinceGreen(repo, workflow, branch, commit) {
    let green;
    try {
        [green] = ghJson(["api", `repos/${repo}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&status=success&per_page=1`]).workflow_runs;
    } catch (error) {
        return { error: error.message };
    }
    if (!green) return null;
    const range = { from: green.head_sha, greenRunUrl: green.html_url, compareUrl: `https://github.com/${repo}/compare/${green.head_sha.slice(0, 12)}...${commit.slice(0, 12)}` };
    try {
        const compared = ghJson(["api", `repos/${repo}/compare/${green.head_sha}...${commit}`]);
        return { ...range, total: compared.total_commits, commits: compared.commits.map((item) => ({ sha: item.sha, subject: item.commit.message.split("\n")[0] })) };
    } catch (error) {
        return { ...range, error: error.message };
    }
}

function issue() {
    const { output, jobs, unit } = readNeeds();
    const repo = process.env.GITHUB_REPOSITORY;
    const run = { url: process.env.RUN_URL, commit: process.env.COMMIT, date: today(), branch: process.env.BRANCH };
    const title = issueTitle(run.branch, gh(["api", `repos/${repo}`, "--jq", ".default_branch"]));
    // The list API, not search: an issue opened a minute ago is already in it.
    const open = ghJson(["issue", "list", "--repo", repo, "--state", "open", "--limit", "200", "--json", "number,title,url"]).find((item) => item.title === title) ?? null;
    const passed = nightlyPassed(jobs);
    const report = passed ? null : failureReport({ jobs, unit, run, templateLine: output("template-unchanged", "line"), range: rangeSinceGreen(repo, process.env.WORKFLOW_FILE, run.branch, run.commit) });
    const plan = planIssue({ passed, open, report, run });
    let url = plan.url ?? "";
    if (plan.action === "open") url = gh(["issue", "create", "--repo", repo, "--title", title, "--body-file", "-"], plan.body);
    if (plan.action === "comment") gh(["issue", "comment", String(plan.number), "--repo", repo, "--body-file", "-"], plan.body);
    if (plan.action === "close") {
        gh(["issue", "comment", String(plan.number), "--repo", repo, "--body-file", "-"], plan.body);
        gh(["issue", "close", String(plan.number), "--repo", repo]);
    }
    console.error(`failure issue "${title}": ${plan.action}${url ? ` ${url}` : ""}`);
    console.log(`action=${plan.action}`);
    console.log(`url=${url}`);
}

try {
    if (command === "unit") {
        const summary = parseUnitLog(logText());
        console.log(`summary=${summary ? JSON.stringify(summary) : ""}`);
    } else if (command === "template") {
        console.log(`line=${parseTemplateLine(logText()) ?? ""}`);
    } else if (command === "build") {
        build();
    } else if (command === "send") {
        await send();
    } else if (command === "issue") {
        issue();
    } else {
        throw new Error(`unknown command: ${command}`);
    }
} catch (error) {
    console.error(`nightly email: ${error.message}`);
    process.exitCode = 1;
}
