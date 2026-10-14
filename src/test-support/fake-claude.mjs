// Phase 42 (TFP-194): a stand-in for `claude -p --output-format json`, so the gap
// writer's tests run the real call path without reaching Claude Code. Reads the
// prompt from stdin, appends { args, prompt, session } to FAKE_CLAUDE_LOG, and
// answers as FAKE_CLAUDE_MODE says:
//   good    - a body that finds the target with TestForge's own locator
//   revise  - first a body that fails, then (on --resume) the good one
//   breach  - a body that POSTs, which the read-only gate must reject
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const log = process.env.FAKE_CLAUDE_LOG;
const prompt = readFileSync(0, "utf8");
const args = process.argv.slice(2);
const resumed = args.includes("--resume");
const session = resumed ? args[args.indexOf("--resume") + 1] : `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const earlier = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
appendFileSync(log, `${JSON.stringify({ args, prompt, session })}\n`);

// The target is in the session's first prompt.
const first = resumed ? earlier.find((call) => call.session === session && !call.args.includes("--resume"))?.prompt ?? prompt : prompt;
const page = /await page\.goto\('([^']+)'\)/.exec(first)?.[1] ?? "/";
const locator = /TestForge finds it with: (.+)/.exec(first)?.[1]?.trim() ?? "page.locator('body')";
const good = `await page.goto('${page}');\nawait expect(${locator}.first()).toBeAttached();`;
const mode = process.env.FAKE_CLAUDE_MODE ?? "good";
const body = mode === "breach"
    ? `await page.goto('${page}');\nawait page.evaluate(() => fetch('/api/store/cart', { method: 'POST', body: '{}' }));`
    : mode === "revise" && !resumed
        ? `await page.goto('${page}');\nawait expect(page.locator('#testforge-not-there')).toBeVisible({ timeout: 1000 });`
        : good;

process.stdout.write(JSON.stringify({ type: "result", is_error: false, result: "```ts\n" + body + "\n```", total_cost_usd: 0.0125, session_id: session }));
