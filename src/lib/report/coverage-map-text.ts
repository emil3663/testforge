import type { CoverageMap } from "./types";

/** Phase 42 (TFP-192, TFP-201): the coverage map's headline - both tiers, and links as distinct items - for the app's report and the HTML export alike. */
export function describeCoverageMap(map: CoverageMap): string {
    const gaps = map.total - map.covered;
    const reached = map.reachedOnly ?? 0;
    const untouched = gaps - reached;
    const links = map.links && map.links.onPages !== map.links.distinct ? ` Links are counted once each: ${map.links.distinct} distinct links, found ${map.links.onPages} times across the pages.` : "";
    const parts: string[] = [];
    if (reached > 0) parts.push(`${reached} more ${reached === 1 ? "is" : "are"} only reached (a link's URL requested, the link not checked on a page)`);
    if (untouched > 0) parts.push(`${untouched} ${untouched === 1 ? "is" : "are"} touched by no test`);
    const tail = gaps === 0 ? "nothing is left unchecked" : parts.join(", and ");
    return `${map.covered} of the ${map.total} elements, links and flows the inspection found are checked in context by a test; ${tail}.${links}`;
}

/** One page type's row: checked in context of total, how many only reached, on how many pages. */
export function describeCoverageMapType(type: CoverageMap["types"][number]): string {
    const reached = type.reachedOnly ? `, ${type.reachedOnly} more only reached` : "";
    return `${type.covered} of ${type.total} in context${reached}, on ${type.pages} ${type.pages === 1 ? "page" : "pages"}`;
}
