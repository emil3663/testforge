import { inspectPages } from "@/lib/introspect/inspector";
import { normalizeInspectionPathList } from "@/lib/introspect/paths";
import type { PageInspectionRecord } from "@/lib/report/types";

// Phase 34 TFP-122 (Decision 11): when a generate request brings no page data,
// TestForge inspects the pages itself - the same introspection the app's own
// flow runs, called directly rather than over HTTP. TFP-120 found the one gap
// left for the local model was "database without page data", where it had to
// invent a flow; with page data the template writes a real round trip or says
// the area doesn't apply.
//
// It never blocks generation: if nothing could be inspected (site unreachable,
// timeout, browser failure), the caller generates exactly as it would have
// without page data, and the reason is reported.

const MAX_WARNINGS = 5;

/** A Playwright error's first line, without its terminal colour codes or call log: readable in a report. */
function readable(message: string) {
    return message.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].trim();
}

export interface AutomaticInspection {
    /** The inspection result, shaped like POST /api/introspect's response; null when it failed. */
    profile: unknown;
    record: PageInspectionRecord;
}

export async function inspectForGeneration(baseUrl: string, requestedPaths: unknown): Promise<AutomaticInspection> {
    const paths = normalizeInspectionPathList(baseUrl, requestedPaths);
    try {
        const result = await inspectPages(baseUrl, paths);
        const warnings = result.warnings.slice(0, MAX_WARNINGS).map(readable);
        if (result.pages.length === 0) {
            return {
                profile: null,
                record: { status: "failed", paths, pages: 0, warnings, reason: warnings[0] ?? "no page could be inspected" },
            };
        }
        return {
            profile: { scannedAt: new Date().toISOString(), baseUrl, ...result },
            record: { status: "inspected", paths, pages: result.pages.length, warnings },
        };
    } catch (error) {
        return {
            profile: null,
            record: { status: "failed", paths, pages: 0, warnings: [], reason: `page inspection could not run: ${readable(error instanceof Error ? error.message : String(error))}` },
        };
    }
}
