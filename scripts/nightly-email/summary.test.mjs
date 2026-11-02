/**
 * TFP-217: the nightly summary and how a send fails.
 *
 * Run via:
 * node --test scripts/nightly-email/summary.test.mjs
 */
import assert from "node:assert";
import { test } from "node:test";
import { sendSummary } from "./send.mjs";
import { buildSummary, MAX_FAILING_NAMES, parseTemplateLine, parseUnitLog } from "./summary.mjs";

const RUN = { url: "https://github.com/o/r/actions/runs/7", trigger: "schedule", commit: "4eff1dc9a0b1c2d3", base: "24c4449", date: "2026-10-20" };
const ALL_GREEN = { unit: "success", audit: "success", "dead-code": "success", "template-unchanged": "success" };
const COUNTS = { tests: 658, pass: 657, fail: 0, cancelled: 0, skipped: 1, duration_ms: 1196617.5, failing: [] };
const TEMPLATE = "24c4449 -> 2036c1d: 166 inputs, 166 identical, 0 different";

// As node:test's spec reporter writes it (the shape of a real nightly's unit.log).
const LOG = (failing) => [
    "> testforge@0.2.0 test:unit",
    "✔ an ordinary test (12.5ms)",
    "ℹ run 1: busiest second 5 arrivals; a test's own ℹ line",
    "ℹ tests 658",
    "ℹ suites 0",
    `ℹ pass ${658 - failing.length}`,
    `ℹ fail ${failing.length}`,
    "ℹ cancelled 0",
    "ℹ skipped 0",
    "ℹ todo 0",
    "ℹ duration_ms 1196617.545456",
    ...(failing.length ? ["", "✖ failing tests:", "", ...failing.flatMap((name, at) => [`test at src\\a.test.ts:${at}:1`, `✖ ${name} (1.5ms)`, "  AssertionError [ERR_ASSERTION]: no", "  ✖ not a test name"])] : []),
].join("\n");

test("a passing run: PASS, the short commit and date in the subject, the counts, the template line and the link", () => {
    const { subject, body, passed } = buildSummary({ jobs: ALL_GREEN, unit: COUNTS, templateLine: TEMPLATE, run: RUN });
    assert.equal(subject, "TestForge nightly: PASS · 4eff1dc · 2026-10-20");
    assert.equal(passed, true);
    assert.ok(body.includes(RUN.url), body);
    assert.ok(body.includes("Trigger: schedule"), body);
    assert.ok(body.includes("Commit: 4eff1dc"), body);
    assert.ok(body.includes("Template base: 24c4449"), body);
    assert.ok(body.includes("unit: success"), body);
    assert.ok(body.includes("tests 658, pass 657, fail 0, cancelled 0, skipped 1, duration 19.9 min"), body);
    assert.ok(!body.includes("duration_ms"), body);
    assert.ok(body.includes(`template-unchanged: success\n${TEMPLATE}`), body);
    assert.ok(!body.includes("Failing tests"), body);
});

test("failing tests: FAIL, each name, capped at 20 with how many more", () => {
    const failing = Array.from({ length: 23 }, (_, at) => `failing test ${at + 1}`);
    const { subject, body, passed } = buildSummary({ jobs: { ...ALL_GREEN, unit: "failure" }, unit: { ...COUNTS, fail: 23, failing }, templateLine: TEMPLATE, run: RUN });
    assert.equal(MAX_FAILING_NAMES, 20);
    assert.equal(subject, "TestForge nightly: FAIL · 4eff1dc · 2026-10-20");
    assert.equal(passed, false);
    assert.ok(body.includes("failing test 20\n"), body);
    assert.ok(!body.includes("failing test 21"), body);
    assert.ok(body.includes("and 3 more"), body);
});

test("the unit duration reads in minutes, to one decimal place", () => {
    const duration = (ms) => buildSummary({ jobs: ALL_GREEN, unit: { ...COUNTS, duration_ms: ms }, templateLine: TEMPLATE, run: RUN }).body;
    assert.ok(duration(1009532.209072).includes("duration 16.8 min"), duration(1009532.209072));
    assert.ok(duration(60000).includes("duration 1.0 min"), duration(60000));
    assert.ok(duration(0).includes("duration 0.0 min"), duration(0));
});

test("exactly 20 failing tests: all named, no 'and N more'", () => {
    const failing = Array.from({ length: 20 }, (_, at) => `failing test ${at + 1}`);
    const { body } = buildSummary({ jobs: { ...ALL_GREEN, unit: "failure" }, unit: { ...COUNTS, fail: 20, failing }, templateLine: TEMPLATE, run: RUN });
    assert.ok(body.includes("failing test 20"), body);
    assert.ok(!body.includes("more"), body);
});

test("a cancelled job with no counts: FAIL, and the body says the counts can't be read", () => {
    const { subject, body } = buildSummary({ jobs: { ...ALL_GREEN, unit: "cancelled", "template-unchanged": "cancelled" }, unit: null, templateLine: null, run: RUN });
    assert.ok(subject.startsWith("TestForge nightly: FAIL"), subject);
    assert.ok(body.includes("unit: cancelled"), body);
    assert.ok(body.includes("Counts can't be read: the job was cancelled before its summary."), body);
    assert.ok(body.includes("Check line can't be read: the job was cancelled before its summary."), body);
});

test("a job that failed before its summary is worded as a failure", () => {
    const { body } = buildSummary({ jobs: { ...ALL_GREEN, unit: "failure" }, unit: null, templateLine: TEMPLATE, run: RUN });
    assert.ok(body.includes("Counts can't be read: the job failed before its summary."), body);
});

for (const job of Object.keys(ALL_GREEN)) {
    for (const result of ["failure", "cancelled", "skipped"]) {
        test(`${job} ${result}: FAIL, even with every other job green`, () => {
            const { subject, passed, body } = buildSummary({ jobs: { ...ALL_GREEN, [job]: result }, unit: COUNTS, templateLine: TEMPLATE, run: RUN });
            assert.ok(subject.startsWith("TestForge nightly: FAIL"), subject);
            assert.equal(passed, false);
            assert.ok(body.includes(`${job}: ${result}`), body);
        });
    }
}

test("a job that didn't report at all is a FAIL, not a pass by omission", () => {
    const { audit, ...withoutAudit } = ALL_GREEN;
    assert.equal(audit, "success");
    const { subject, body } = buildSummary({ jobs: withoutAudit, unit: COUNTS, templateLine: TEMPLATE, run: RUN });
    assert.ok(subject.startsWith("TestForge nightly: FAIL"), subject);
    assert.ok(body.includes("audit: not reported"), body);
});

test("a green job with counts that can't be read still says so", () => {
    const { body, passed } = buildSummary({ jobs: ALL_GREEN, unit: null, templateLine: null, run: RUN });
    assert.equal(passed, true);
    assert.ok(body.includes("Counts can't be read: the job's summary wasn't found in its log."), body);
    assert.ok(body.includes("Check line can't be read: the job's summary wasn't found in its log."), body);
});

test("parseUnitLog reads the summary and each failing test's name", () => {
    assert.deepEqual(parseUnitLog(LOG(["first failure", "second (with brackets) failure"])), {
        tests: 658,
        suites: 0,
        pass: 656,
        fail: 2,
        cancelled: 0,
        skipped: 0,
        todo: 0,
        duration_ms: 1196617.545456,
        failing: ["first failure", "second (with brackets) failure"],
    });
});

test("parseUnitLog keeps at most 20 names, and the summary still counts them all", () => {
    const names = Array.from({ length: 23 }, (_, at) => `failing test ${at + 1}`);
    const unit = parseUnitLog(LOG(names));
    assert.equal(unit.failing.length, 20);
    assert.equal(unit.fail, 23);
    const { body } = buildSummary({ jobs: { ...ALL_GREEN, unit: "failure" }, unit, templateLine: TEMPLATE, run: RUN });
    assert.ok(body.includes("failing test 20\n"), body);
    assert.ok(body.includes("and 3 more"), body);
});

test("parseUnitLog: colour codes don't hide the summary", () => {
    const coloured = LOG([]).replace("ℹ tests 658", "\u001b[34mℹ tests 658\u001b[39m");
    assert.equal(parseUnitLog(coloured).tests, 658);
});

test("parseUnitLog: a log with no summary, or none at all, is null", () => {
    assert.equal(parseUnitLog("npm error something failed"), null);
    assert.equal(parseUnitLog(""), null);
    assert.equal(parseUnitLog(LOG([]).replace("ℹ fail 0\n", "")), null);
});

test("parseTemplateLine takes the check's line without its name, and null when it isn't there", () => {
    assert.equal(parseTemplateLine(`noise\ntemplate-unchanged: ${TEMPLATE}\noutputs kept in x`), TEMPLATE);
    assert.equal(parseTemplateLine("template-unchanged: git archive failed"), null);
    assert.equal(parseTemplateLine(""), null);
});

const MESSAGE = { subject: "TestForge nightly: PASS · 4eff1dc · 2026-10-20", body: "the body" };
const transportThat = (sendMail) => ({ createTransport: (options) => ({ options, sendMail }) });

test("a send asks for Gmail over TLS, as testforgeapp, to CI_REPORT_TO, in plain text", async () => {
    let options;
    let mail;
    const createTransport = (given) => {
        options = given;
        return { sendMail: async (sent) => ((mail = sent), { accepted: [sent.to], rejected: [], messageId: "<1>", response: "250 OK" }) };
    };
    const info = await sendSummary({ message: MESSAGE, password: "app-password", to: "ci@example.com", createTransport });
    assert.equal(options.host, "smtp.gmail.com");
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.deepEqual(options.auth, { user: "testforgeapp@gmail.com", pass: "app-password" });
    assert.ok(options.connectionTimeout > 0 && options.socketTimeout > 0, "a hung server must not hang the job");
    assert.equal(mail.from, "testforgeapp@gmail.com");
    assert.equal(mail.to, "ci@example.com");
    assert.equal(mail.subject, MESSAGE.subject);
    assert.equal(mail.text, "the body");
    assert.equal(mail.html, undefined);
    assert.equal(info.response, "250 OK");
});

test("a send with no password, or no recipient, fails by name before any connection", async () => {
    const createTransport = () => assert.fail("no connection may be made");
    await assert.rejects(sendSummary({ message: MESSAGE, password: "", to: "ci@example.com", createTransport }), /TESTFORGE_SMTP_PASSWORD is not set/);
    await assert.rejects(sendSummary({ message: MESSAGE, password: "p", to: " ", createTransport }), /CI_REPORT_TO is not set/);
});

test("a refused send fails with the server's reason, and the password isn't in it", async () => {
    const { createTransport } = transportThat(async () => {
        throw Object.assign(new Error("Invalid login: 535 Username and Password not accepted (secret-pass)"), { code: "EAUTH" });
    });
    await assert.rejects(sendSummary({ message: MESSAGE, password: "secret-pass", to: "ci@example.com", createTransport }), (error) => {
        assert.match(error.message, /EAUTH/);
        assert.match(error.message, /Username and Password not accepted/);
        assert.ok(!error.message.includes("secret-pass"), error.message);
        return true;
    });
});

test("a recipient the server rejected fails the send, as nodemailer reports it: a rejection, EENVELOPE", async () => {
    const { createTransport } = transportThat(async () => {
        throw Object.assign(new Error("Can't send mail - all recipients were rejected: 550 no such user"), { code: "EENVELOPE" });
    });
    await assert.rejects(sendSummary({ message: MESSAGE, password: "app-password", to: "ci@example.com", createTransport }), /EENVELOPE.*all recipients were rejected/);
});
