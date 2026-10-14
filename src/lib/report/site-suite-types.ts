/**
 * Phase 42: the site suite's record in a run's generation record - what was
 * reused, regenerated and retired (TFP-190), what reading failing tests'
 * pages again found (TFP-191), and what the gap writer did (TFP-194).
 * Re-exported from ./types.
 */

/** Phase 42 (TFP-190, Decision 1): what a run reused from its site suite, regenerated and retired. */
export interface SiteSuiteRecord {
    /** Where the site suite is kept (TestForge's local data folder). */
    store: string;
    /** No suite was saved for this site and suite type before this run. */
    firstRun: boolean;
    reused: number;
    /** New tests: a new page type, or a new test on an unchanged one. */
    generated: number;
    /** Tests of a page type whose fingerprint changed. */
    regenerated: number;
    /** Saved tests, not edited, that the generator no longer writes: their page, or what they tested, is gone. */
    retired: number;
    /** Hand-edited tests, kept as they are. */
    edited: number;
    changedTypes: string[];
    newTypes: string[];
    goneTypes: string[];
    /** Hand-edited tests whose page changed or is gone: kept, and named here. */
    editedOnChangedPages: string[];
    /** After the run (TFP-191): the failing reused tests whose pages were read again, and what that found. */
    recheck?: SiteSuiteRecheck;
    /** TFP-194: the gap tests written at this generation, when the site opted in. */
    gapTests?: GapWritingRecord;
    /** TFP-203: pool candidates bound into a Standard suite as their gaps' tests at this generation. */
    candidateTests?: CandidateBindingRecord;
}

/** Phase 42 (TFP-203): candidates tried as gaps' tests on Standard - bound after the gates, or not. */
export interface CandidateBindingRecord {
    bound: number;
    notBound: number;
    tests: Array<{ title: string; covers: string; candidate: string; outcome: string }>;
}

/** Phase 42 (TFP-194): what the site's gap writer was asked for, what it cost, and what came of it. */
export interface GapWritingRecord {
    writer: string;
    /** Gaps on the in-context gap list not yet written for or tried. */
    gaps: number;
    /** Of those, the ones the writer was asked for (at most the limit). */
    asked: number;
    saved: number;
    /** Rejected: a breach of the read-only gate. */
    rejected: number;
    /** Not kept: still failing after the last attempt, invalid, or the writer couldn't be reached. */
    failed: number;
    /** What the writer reported it cost, in US dollars (Claude Code); 0 for the local model. */
    costUsd: number;
    tests: Array<{ title: string; covers: string; attempts: number; costUsd: number; outcome: string }>;
    /** Why no writer was asked, when the opt-in was on but none could be. */
    note?: string;
    /** TFP-195: gaps a pool candidate already matched (no test written), and candidates added or not kept. */
    candidates?: { matched: number; added: number; notKept: number };
}

/** Phase 42 (TFP-191): failing reused tests, their pages read again after the run. */
export interface SiteSuiteRecheck {
    /** Failing tests that were reused, not edited, and of one page type: the ones read again. */
    failedReused: number;
    /** Of those, the ones whose page was unchanged: their failures stand. */
    unchanged: number;
    /** Each page type found changed: written again from a fresh inspection and re-run. */
    regenerations: SiteSuiteRegeneration[];
}

export interface SiteSuiteRegeneration {
    type: string;
    /** The failing tests' pages whose structural signature changed, before and after. */
    pages: Array<{ path: string; before: string; after: string }>;
    /** The reused tests that failed on it. */
    failed: string[];
    /** The type's regenerated tests that were re-run, and how they ended. */
    rerun: number;
    passed: number;
    failedAgain: number;
}
