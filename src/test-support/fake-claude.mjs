// Phase 42 (TFP-194): a stand-in for `claude -p --output-format json`, so the gap
// writer's tests run the real call path without reaching Claude Code. Reads the
// prompt from stdin, appends { args, prompt, session, cwd, cwdEntries } to
// FAKE_CLAUDE_LOG, and answers as FAKE_CLAUDE_MODE says:
//   good    - a body that finds the target with TestForge's own locator
//   revise  - first a body that fails, then (on --resume) the good one
//   breach  - a body that submits a form by POST, which the read-only gate must reject
//             (TFP-202: a fetch would be refused by the code check before it ran)
// TFP-195: a prompt asking to generalise is answered with the good body, its
// page and locator written as the __PAGE__ and __LOCATOR__ blanks. TFP-197: as
// the real Claude Code writes them, both as bare expressions.
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";

const log = process.env.FAKE_CLAUDE_LOG;
const prompt = readFileSync(0, "utf8");
const args = process.argv.slice(2);
const resumed = args.includes("--resume");
const session = resumed ? args[args.indexOf("--resume") + 1] : `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const earlier = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
appendFileSync(log, `${JSON.stringify({ args, prompt, session, cwd: process.cwd(), cwdEntries: readdirSync(process.cwd()).length })}\n`);

// The target is in the session's first prompt, on TFP-202's PAGE-DATA lines (each value a JSON string).
const first = resumed ? earlier.find((call) => call.session === session && !call.args.includes("--resume"))?.prompt ?? prompt : prompt;
const field = (name) => new RegExp(`^${name}: (.+)$`, "m").exec(first)?.[1];
const page = field("page") ? JSON.parse(field("page")) : "/";
const locator = field("locator") && field("locator") !== "(none)" ? JSON.parse(field("locator")) : "page.locator('body')";
const good = `await page.goto('${page}');\nawait expect(${locator}.first()).toBeAttached();`;
const mode = process.env.FAKE_CLAUDE_MODE ?? "good";
const body = prompt.startsWith("Generalise")
    ? `await page.goto(__PAGE__);\nawait expect(__LOCATOR__.first()).toBeAttached();`
    : mode === "breach"
    ? `await page.goto('${page}');\nawait page.evaluate(() => { const form = document.createElement('form'); form.method = 'post'; form.action = '/api/store/cart'; document.body.append(form); form.submit(); });`
    : mode === "revise" && !resumed
        ? `await page.goto('${page}');\nawait expect(page.locator('#testforge-not-there')).toBeVisible({ timeout: 1000 });`
        : good;

process.stdout.write(JSON.stringify({ type: "result", is_error: false, result: "```ts\n" + body + "\n```", total_cost_usd: 0.0125, session_id: session }));
