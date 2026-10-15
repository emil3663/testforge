// TFP-197: a pass-through in front of the real Claude Code, so each gap-writer call is timed and its cost kept.
// TestForge's own call path (src/lib/gap-writer/writers.ts runClaude) is unchanged: TESTFORGE_CLAUDE_COMMAND
// points it here, with the same arguments and the prompt on stdin, and this runs claude.exe with exactly those
// arguments (no shell, so the empty `--tools ""` arrives as is), from the same temporary folder, and hands back
// its stdout and exit code untouched. Each call appends one line to TFP197_CLAUDE_LOG:
//   { at, ms, args, cwd, cwdEntries, exit, prompt, reply: { is_error, result, total_cost_usd, duration_ms,
//     duration_api_ms, num_turns, session_id, usage, modelUsage } }
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";

const log = process.env.TFP197_CLAUDE_LOG;
if (!log) {
    process.stderr.write("TFP197_CLAUDE_LOG is not set\n");
    process.exit(2);
}
// TFP197_CLAUDE_EXE: the program to run instead of claude on PATH; a JSON array names a program and its first
// arguments (the driver's dry run points it at TFP-194's stand-in).
const configured = process.env.TFP197_CLAUDE_EXE?.trim();
const [exe, ...first] = configured?.startsWith("[") ? JSON.parse(configured) : [configured || execFileSync(process.platform === "win32" ? "where" : "which", ["claude"], { encoding: "utf8" }).split(/\r?\n/).find((line) => /claude(\.exe)?$/i.test(line.trim()))?.trim()];
if (!exe) {
    process.stderr.write("claude not found on PATH\n");
    process.exit(2);
}
const args = process.argv.slice(2);
const prompt = readFileSync(0, "utf8");
const cwdEntries = readdirSync(process.cwd()).length;
const started = Date.now();
const child = spawn(exe, [...first, ...args], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
child.stdin.end(prompt, "utf8");
child.on("close", (code) => {
    let reply = null;
    try {
        const parsed = JSON.parse(stdout);
        reply = { is_error: parsed.is_error, result: parsed.result, total_cost_usd: parsed.total_cost_usd, duration_ms: parsed.duration_ms, duration_api_ms: parsed.duration_api_ms, num_turns: parsed.num_turns, session_id: parsed.session_id, usage: parsed.usage, modelUsage: parsed.modelUsage };
    } catch {
        reply = { unparsed: stdout.slice(0, 2000) };
    }
    appendFileSync(log, `${JSON.stringify({ at: new Date(started).toISOString(), ms: Date.now() - started, args, cwd: process.cwd(), cwdEntries, exit: code, stderr: stderr.slice(0, 2000), prompt, reply })}\n`);
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exit(code ?? 1);
});
