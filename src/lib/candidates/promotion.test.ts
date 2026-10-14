/**
 * Phase 42 (TFP-196, Decision 8's promotion rule): which candidates are
 * offered for promotion, what approval and rejection do, and the library
 * entry an approved one becomes. Through GET and POST /api/candidates, on a
 * pool in a temporary data folder; the library entries go to a temporary
 * folder, not the repo.
 *
 * ISTQB technique: decision table. Conditions: a breach of the gates in any
 * run; a real defect caught (a run labelled real, or a benchmark bug); the
 * sites it ran on (3 needed without a real defect); an unlabelled failure.
 *   no runs                                   -> not offered
 *   2 clean sites                             -> not offered; approving it is refused
 *   3 clean sites                             -> offered
 *   3 sites, one failure unlabelled           -> not offered, until it is labelled
 *   3 clean sites, a breach in one run        -> never offered
 *   1 site, a failure labelled real (bug 27)  -> offered
 * Then: approved -> written as a library entry with its evidence and caught bug,
 * marked promoted, no longer offered; rejected -> kept with its reason, never
 * offered again, and its pattern never pooled anew. Gate: Phase 42 batch 2.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/candidates/promotion.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Candidate, CandidateEvidence } from "./pool.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-promotion-"));
const savedDataDir = process.env.TESTFORGE_DATA_DIR;
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");

const route = await import("../../app/api/candidates/route.ts");
const { NextRequest } = await import("next/server");
const { addToPool, loadCandidate, loadPool, patternOf, poolHas, saveCandidate } = await import("./pool.ts");
const { loadPromotedEntries, promoteApproved } = await import("./promotion.ts");

after(() => {
    if (savedDataDir === undefined) delete process.env.TESTFORGE_DATA_DIR;
    else process.env.TESTFORGE_DATA_DIR = savedDataDir;
    rmSync(scratch, { recursive: true, force: true });
});

const run = (origin: string, status = "Passed", extra: Partial<CandidateEvidence> = {}): CandidateEvidence => ({ origin, page: "/", at: "2026-10-14T12:00:00.000Z", status, run: `run-${origin}-${status}-${Math.random().toString(36).slice(2, 6)}`, ...extra });

async function candidate(name: string, evidence: CandidateEvidence[]): Promise<Candidate> {
    const { candidate: added } = await addToPool({ pattern: patternOf("link", `${name} [link]`), body: "await page.goto('__PAGE__');\nawait expect(__LOCATOR__).toBeVisible();", gate: "read-only", technique: "error guessing", writer: "claude-code", sources: [{ origin: "http://a.test", page: "/", at: "t" }], costUsd: 0.02 });
    const withRuns = { ...added, evidence };
    await saveCandidate(withRuns);
    return withRuns;
}

const post = (body: unknown) => route.POST(new NextRequest(new URL("http://localhost/api/candidates"), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
const offered = async () => ((await (await route.GET()).json()) as { offered: string[] }).offered;

test("only a candidate that meets the rule is offered (decision table)", async () => {
    const none = await candidate("None", []);
    const two = await candidate("Two", [run("http://a.test"), run("http://b.test")]);
    const three = await candidate("Three", [run("http://a.test"), run("http://b.test"), run("http://c.test")]);
    const unlabelled = await candidate("Unlabelled", [run("http://a.test"), run("http://b.test"), run("http://c.test", "Failed")]);
    const breach = await candidate("Breach", [run("http://a.test"), run("http://b.test"), run("http://c.test", "Failed", { breach: true, label: "not a defect" })]);
    const real = await candidate("Real", [run("http://a.test", "Failed", { label: "real", bug: 27 })]);

    const list = await offered();
    assert.deepEqual(list.sort(), [three.id, real.id].sort());
    for (const below of [none, two, unlabelled, breach]) assert.ok(!list.includes(below.id));

    // Approving one below the rule is refused, naming why.
    const refused = await post({ action: "approve", id: two.id, by: "Emil" });
    assert.equal(refused.status, 409);
    assert.match((await refused.json()).error, /doesn't meet the promotion rule: .*it ran on 2 sites \(3 needed without one\)/);
    assert.equal((await loadCandidate(two.id))!.status, "candidate");

    // A failure labelled not a defect: then the three sites count.
    const failedRun = unlabelled.evidence.find((evidence) => evidence.status === "Failed")!.run!;
    assert.equal((await post({ action: "label", id: unlabelled.id, run: failedRun, label: "not a defect" })).status, 200);
    assert.ok((await offered()).includes(unlabelled.id));
    // A breach is never offered, whatever its label.
    assert.ok(!(await offered()).includes(breach.id));
});

test("approved: written as a library entry with its evidence, marked promoted, no longer offered", async () => {
    const pool = await loadPool();
    const real = pool.find((item) => item.pattern.name === "real")!;
    assert.equal((await post({ action: "approve", id: real.id })).status, 400, "an approval names who approved it");
    assert.equal((await post({ action: "approve", id: real.id, by: "Emil" })).status, 200);
    assert.equal((await loadCandidate(real.id))!.status, "approved");
    assert.ok(!(await offered()).includes(real.id));

    const library = join(scratch, "library");
    const written = await promoteApproved(library);
    assert.equal(written.length, 1);
    const [entry] = await loadPromotedEntries(library);
    assert.equal(entry.id, real.id);
    assert.deepEqual(entry.caught, [27]);
    assert.deepEqual(entry.evidence, real.evidence);
    assert.equal(entry.approved.by, "Emil");
    assert.deepEqual(JSON.parse(readFileSync(written[0], "utf8")).pattern, real.pattern);
    const promoted = (await loadCandidate(real.id))!;
    assert.equal(promoted.status, "promoted");
    assert.match(promoted.reason!, /^library entry /);
    assert.deepEqual(await promoteApproved(library), [], "promoted once");
});

test("rejected: kept with its reason, never offered again, and its pattern never pooled anew", async () => {
    const three = (await loadPool()).find((item) => item.pattern.name === "three")!;
    assert.equal((await post({ action: "reject", id: three.id, reason: "" })).status, 409, "a rejection needs its reason");
    assert.equal((await post({ action: "reject", id: three.id, reason: "checks only that the link is visible" })).status, 200);
    const rejected = (await loadCandidate(three.id))!;
    assert.deepEqual([rejected.status, rejected.reason], ["rejected", "checks only that the link is visible"]);
    assert.ok(!(await offered()).includes(three.id));
    assert.equal((await post({ action: "approve", id: three.id, by: "Emil" })).status, 409);
    assert.ok(poolHas(await loadPool(), three.pattern), "so TFP-195 won't propose the pattern again");
});
