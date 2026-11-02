// TFP-217: what nightly.yml's steps run. Each job passes on what it found as an output, and the notify job builds the
// summary from them and sends it.
//
//   node scripts/nightly-email/notify.mjs unit <unit.log>          prints `summary=<json>` for $GITHUB_OUTPUT
//   node scripts/nightly-email/notify.mjs template <template.log>  prints `line=<the check's line>`
//   node scripts/nightly-email/notify.mjs build <message.json>     writes the message and the run page's summary
//   node scripts/nightly-email/notify.mjs send <message.json>      sends it
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { sendSummary } from "./send.mjs";
import { buildSummary, parseTemplateLine, parseUnitLog } from "./summary.mjs";

const [command, file] = process.argv.slice(2);
const logText = () => (existsSync(file) ? readFileSync(file, "utf8") : "");

function build() {
    const needs = JSON.parse(process.env.NEEDS);
    const output = (job, name) => needs[job]?.outputs?.[name] || null;
    const jobs = Object.fromEntries(Object.entries(needs).map(([job, { result }]) => [job, result]));
    const unit = JSON.parse(output("unit", "summary") ?? "null");
    const run = { url: process.env.RUN_URL, trigger: process.env.TRIGGER, commit: process.env.COMMIT, base: process.env.TEMPLATE_BASE, date: new Date().toISOString().slice(0, 10) };
    const message = buildSummary({ jobs, unit, templateLine: output("template-unchanged", "line"), run });
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
    } else {
        throw new Error(`unknown command: ${command}`);
    }
} catch (error) {
    console.error(`nightly email: ${error.message}`);
    process.exitCode = 1;
}
