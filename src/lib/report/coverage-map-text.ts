import type { CoverageMap } from "./types";

/** Phase 42 (TFP-192): the coverage map's headline, for the app's report and the HTML export alike. */
export function describeCoverageMap(map: CoverageMap): string {
    const untouched = map.total - map.covered;
    return `${map.covered} of the ${map.total} elements, links and flows the inspection found are touched by a test; ${untouched === 0 ? "nothing is left untouched" : `${untouched} ${untouched === 1 ? "is" : "are"} touched by none`}.`;
}

/** One page type's row: covered of total, on how many pages. */
export function describeCoverageMapType(type: CoverageMap["types"][number]): string {
    return `${type.covered} of ${type.total} on ${type.pages} ${type.pages === 1 ? "page" : "pages"}`;
}
