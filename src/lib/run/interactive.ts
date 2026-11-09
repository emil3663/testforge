// Journey tests (and any later test that submits or mutates on the live
// site) are skipped unless a run explicitly sets this - Decision 2 of the
// Phase 19 record, the roadmap's "interactive tests skip unless explicitly
// enabled per run". executor.ts always sets it for the Playwright process,
// to "0" as well as "1", so an ambient value in the operator's shell can't
// enable it by accident. Kept in its own module so the UI can import it
// without pulling in the generator.
export const INTERACTIVE_ENV_VAR = "MRONION_INTERACTIVE";

/** Phase 48 (TFP-278): the name 0.2.x's suites check. A run sets both, so a saved suite runs as it did (Decision 8). */
export const OLD_INTERACTIVE_ENV_VAR = "TESTFORGE_INTERACTIVE";

/** Whether a suite has tests behind the interactive switch: one that checks it, by either name. */
export function checksInteractiveSwitch(code: string): boolean {
    return code.includes(INTERACTIVE_ENV_VAR) || code.includes(OLD_INTERACTIVE_ENV_VAR);
}
