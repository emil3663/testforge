// Phase 38 Decision 1 (TFP-146): every generated test runs behind one of
// three gates, declared in a static `gate` annotation.
// - read-only: loading pages and reading what comes back, the axe scan,
//   interactions that send nothing to the server, and one missing-page probe
//   per run. Always on. Phase 41 Decision 3 (TFP-181) widens it: an
//   interaction whose requests are all GETs and that submits no form (a
//   sort, a filter, a stepper, a link followed) is read-only too, run under
//   the request guard (src/lib/generate/read-only-guard.ts), which aborts
//   anything else and fails the test as a guard breach.
// - interactive: submitting forms with valid or harmlessly invalid data. Runs
//   only with TESTFORGE_INTERACTIVE=1 (Phase 19 Decision 2, unchanged).
// - active: attack-shaped input, lockout and rate-limit probing, load testing.
//   Runs only after Phase 35 Decision 8's typed ownership confirmation, which
//   is not built, so it is always closed (Decision 6).
// A closed gate makes the test Not run with its reason, never absent and
// never failed. Kept apart from the generator, like interactive.ts, so the
// report and the UI can import it.

export const TEST_GATES = ["read-only", "interactive", "active"] as const;
export type TestGate = (typeof TEST_GATES)[number];

/** The static annotation type each generated test declares its gate in. */
export const GATE_ANNOTATION = "gate";

/** Decision 6's reason for every active-gate test while the confirmation is not built. */
export const ACTIVE_GATE_REASON = "attack-shaped input: needs the ownership confirmation, not built yet";

export function isTestGate(value: unknown): value is TestGate {
    return typeof value === "string" && (TEST_GATES as readonly string[]).includes(value);
}

/** `{ annotation: { type: 'gate', description: '<gate>' } }`: a test's or describe's details argument. */
export function gateDetails(gate: TestGate) {
    return `{ annotation: ${gateAnnotation(gate)} }`;
}

/** One `{ type: 'gate', ... }` entry, for a details object that carries other annotations too. */
export function gateAnnotation(gate: TestGate) {
    return `{ type: '${GATE_ANNOTATION}', description: '${gate}' }`;
}

/**
 * The gates closed for a run: active always (Decision 6), interactive unless
 * the run turned interactive tests on. Read-only never closes.
 */
export function closedGates(interactiveEnabled: boolean): TestGate[] {
    return interactiveEnabled ? ["active"] : ["interactive", "active"];
}

/** The first statement of an active-gate test: closed until the confirmation exists. */
export const ACTIVE_GATE_SKIP = `test.skip(true, '${ACTIVE_GATE_REASON}');`;

// A test call with no details argument yet: `test('title', async ...`.
const UNDECLARED_TEST = /^(\s*test\('(?:[^'\\]|\\.)*'),\s*async\b/;

/**
 * Decision 3: every test that is not interactive or active is read-only. The
 * builders of interactive and active tests declare their gate in the test
 * itself; every other Standard test gets read-only here, where suites are
 * rendered, so no builder can leave a test without one.
 */
export function withDefaultGate(testSource: string, gate: TestGate = "read-only") {
    return testSource.replace(UNDECLARED_TEST, (_match, head: string) => `${head}, ${gateDetails(gate)}, async`);
}
