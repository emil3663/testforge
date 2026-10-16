/**
 * Which of this process's runs were asked for in napi: TestForge's runId →
 * the napi row it must land on. In memory only, like the run jobs themselves;
 * a run claimed and lost to a restart stays "started" in napi, visible as
 * exactly that.
 */
export interface Claim {
    uuid: string;
    runUid: string;
    /** A stop napi asked for was passed on to this server already. */
    cancelled?: boolean;
}

// On globalThis for the same reason as persistence's listeners: `next dev` may load this module twice.
const claims: Map<string, Claim> = ((globalThis as { __testforgeNapiClaims?: Map<string, Claim> }).__testforgeNapiClaims ??= new Map());

export function claimRun(testforgeRunId: string, napi: Claim): void {
    claims.set(testforgeRunId, napi);
}

export function claimedBy(testforgeRunId: string): Claim | undefined {
    return claims.get(testforgeRunId);
}

export function releaseClaim(testforgeRunId: string): void {
    claims.delete(testforgeRunId);
}

export function activeClaims(): Array<[string, Claim]> {
    return [...claims.entries()];
}
