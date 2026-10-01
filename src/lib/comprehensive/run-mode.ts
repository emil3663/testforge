// Phase 35 (TFP-132, Decisions 1 and 2): a run is Standard - today's
// breadth run, unchanged - or Comprehensive for one area the user chose, on
// every inspected page up to a cap. This first slice offers two areas:
// security at the passive level, and accessibility.

export const COMPREHENSIVE_AREAS = ["security", "accessibility"] as const;
export type ComprehensiveArea = (typeof COMPREHENSIVE_AREAS)[number];

/** Decision 2: up to 20 pages by default, configurable. */
export const DEFAULT_PAGE_CAP = 20;
export const MAX_PAGE_CAP = 100;

export interface ComprehensiveRunMode {
    kind: "comprehensive";
    area: ComprehensiveArea;
    /** Security has levels (passive, authenticated, active); only passive exists. */
    level: "passive" | null;
    pageCap: number;
}

export type RunMode = { kind: "standard" } | ComprehensiveRunMode;

export const STANDARD_RUN: RunMode = { kind: "standard" };

export class RunModeError extends Error {}

/**
 * The run mode a request asked for. Absent or `{ kind: "standard" }` is a
 * Standard run, exactly as before this existed. Anything else must be a
 * valid Comprehensive request: an unknown area, level or kind is an error,
 * never a quiet fall back to a different run than the one asked for.
 */
export function normalizeRunMode(input: unknown): RunMode {
    if (input === undefined || input === null) return STANDARD_RUN;
    if (typeof input !== "object") throw new RunModeError("runMode must be an object");
    const value = input as Record<string, unknown>;
    if (value.kind === "standard") return STANDARD_RUN;
    if (value.kind !== "comprehensive") throw new RunModeError(`runMode.kind must be "standard" or "comprehensive"`);
    if (!(COMPREHENSIVE_AREAS as readonly unknown[]).includes(value.area)) {
        throw new RunModeError(`runMode.area must be one of: ${COMPREHENSIVE_AREAS.join(", ")}`);
    }
    const area = value.area as ComprehensiveArea;
    if (area === "security" && value.level !== undefined && value.level !== "passive") {
        throw new RunModeError(`only the passive security level exists; "${String(value.level)}" is not built`);
    }
    if (area === "accessibility" && value.level !== undefined && value.level !== null) {
        throw new RunModeError("accessibility has no levels");
    }
    let pageCap = DEFAULT_PAGE_CAP;
    if (value.pageCap !== undefined) {
        if (typeof value.pageCap !== "number" || !Number.isInteger(value.pageCap) || value.pageCap < 1 || value.pageCap > MAX_PAGE_CAP) {
            throw new RunModeError(`runMode.pageCap must be a whole number from 1 to ${MAX_PAGE_CAP}`);
        }
        pageCap = value.pageCap;
    }
    return { kind: "comprehensive", area, level: area === "security" ? "passive" : null, pageCap };
}

export function isComprehensive(mode: RunMode | null | undefined): mode is ComprehensiveRunMode {
    return mode?.kind === "comprehensive";
}

/** "Comprehensive security (passive)", "Comprehensive accessibility". */
export function comprehensiveLabel(mode: ComprehensiveRunMode): string {
    return `Comprehensive ${mode.area}${mode.level ? ` (${mode.level})` : ""}`;
}

/**
 * A host only the person running TestForge can reach: localhost, a
 * `.localhost` name, or a loopback address. Anything else is someone's site.
 */
export function isLocalDevelopmentHost(baseUrl: string | undefined): boolean {
    if (!baseUrl) return false;
    let hostname: string;
    try {
        hostname = new URL(baseUrl).hostname.toLowerCase();
    } catch {
        return false;
    }
    hostname = hostname.replace(/^\[|\]$/g, "");
    return (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname === "::1" ||
        hostname === "0.0.0.0" ||
        /^127(\.\d{1,3}){3}$/.test(hostname)
    );
}

/**
 * Decision 2: a Comprehensive run uses one Playwright worker, so it doesn't
 * load a site like an attack would. Since TFP-133 the generated suite
 * enforces this itself on every host (added at Gate A: the rule must not
 * depend on the caller), so a Comprehensive run is one worker everywhere and
 * says so. Standard runs keep their audit-mode worker count.
 */
export function workerCountFor(mode: RunMode, _baseUrl: string | undefined, standardWorkers: number): number {
    return isComprehensive(mode) ? 1 : standardWorkers;
}
