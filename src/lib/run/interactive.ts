// Journey tests (and any later test that submits or mutates on the live
// site) are skipped unless a run explicitly sets this - Decision 2 of the
// Phase 19 record, the roadmap's "interactive tests skip unless explicitly
// enabled per run". executor.ts always sets it for the Playwright process,
// to "0" as well as "1", so an ambient value in the operator's shell can't
// enable it by accident. Kept in its own module so the UI can import it
// without pulling in the generator.
export const INTERACTIVE_ENV_VAR = "TESTFORGE_INTERACTIVE";
