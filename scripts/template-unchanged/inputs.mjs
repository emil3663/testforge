// Phase 35 TFP-137: the fixed inputs the template-unchanged check runs on
// every ref. The first 166 are exactly the verifier's (2026-10-01), so
// results stay comparable with earlier checks; changing this list is its own
// decision. Areas are written out here, not imported from a ref, so both
// sides of a comparison always run the same inputs.
//
// TFP-258 added 6 after them, so every helper the generator can write is
// reached (helper-coverage.test.mjs): selected journeys and a hash-route link,
// on the page data, in both audit modes, and Comprehensive's two areas.

export const AREAS = [
    "functional",
    "responsive/mobile",
    "performance/load",
    "security",
    "accessibility",
    "usability",
    "seo/content",
    "cookie/session",
    "database",
    "reliability",
];

export const TARGETS = ["http://127.0.0.1:4410", "https://the-internet.herokuapp.com", "https://demoqa.com"];
export const MODES = ["fast", "deep"];
export const PERFORMANCE_WORDS = ["performance", "load time", "speed", "response time"];

/** Page data for the 22 inputs that carry it, read from the working tree on both sides. */
export const CONTENT_PROFILE_PATH = "benchmarks/2026-09-29/content-profile.json";
export const PAGE_DATA_TARGET = "http://127.0.0.1:4410";

function requests() {
    const list = [];
    for (const area of AREAS) list.push({ description: "Check the home page.", practices: [area] });
    list.push({ description: "Check the home page.", practices: [] });
    for (const word of PERFORMANCE_WORDS) {
        for (const practices of [["performance/load"], [], ["functional"]]) {
            list.push({ description: `Check the ${word} of the home page.`, practices });
        }
    }
    list.push({ description: "Check security and save data, update cookies, accessibility and seo.", practices: [] });
    return list;
}

/** TFP-258: what the Standard variants change. Journeys reach JOURNEY_HELPERS; a hash route, the route helpers. */
export const VARIANTS = ["journeys selected", "a hash-route link"];
/** TFP-258: Comprehensive's areas, written out as AREAS is. Only they write PROBE_HELPERS. */
export const COMPREHENSIVE_AREAS = ["security", "accessibility"];

function key(input) {
    if (input.comprehensive) return ["comprehensive", "page-data", input.baseUrl, input.comprehensive].join(" | ");
    const parts = [input.pageData ? "page-data" : "no-page-data", input.baseUrl, input.mode, input.description, input.practices.join("+") || "(no areas)"];
    return [...parts, ...(input.variant ? [input.variant] : [])].join(" | ");
}

/**
 * TFP-258: the page data with one more journey, along the graph's first edge between two pages. Its own 10 journeys
 * all revisit a page (a form that posts to itself), which normalizeContentProfile dropped until TFP-268; this one
 * doesn't, so JOURNEY_HELPERS was reached either way. Kept, so the inputs and their keys stay as they were.
 */
export function withJourney(profile) {
    const edge = profile.siteGraph.edges.find((candidate) => candidate.from !== candidate.to);
    const journey = { ...profile.journeys[0], id: `automatic||${edge.from} > ${edge.to}`, path: [edge.from, edge.to], steps: [edge] };
    return { ...profile, journeys: [...profile.journeys, journey] };
}

/** TFP-258: the page data with one link to a route of a hash-routed app added to its first page. */
export function withHashRouteLink(profile) {
    const [first, ...rest] = profile.pages;
    const link = { ...first.linkDetails[0], text: "Contact", url: `${PAGE_DATA_TARGET}/#/contact`, rawHref: "#/contact" };
    return { ...profile, pages: [{ ...first, linkDetails: [...first.linkDetails, link] }, ...rest] };
}

/**
 * The 166: 144 without page data, then 22 with it; each with a stable, readable key. Every one is a Standard
 * mockGenerate request, which is what the tests and benchmark scripts that loop over these expect.
 */
export function buildInputs() {
    const inputs = [];
    for (const baseUrl of TARGETS) {
        for (const mode of MODES) {
            for (const request of requests()) inputs.push({ baseUrl, mode, pageData: false, ...request });
        }
    }
    for (const mode of MODES) {
        for (const practices of [...AREAS.map((area) => [area]), []]) {
            inputs.push({ baseUrl: PAGE_DATA_TARGET, mode, pageData: true, description: "Check the site.", practices });
        }
    }
    return inputs.map((input) => ({ ...input, key: key(input) }));
}

/** What the check runs: the 166, then TFP-258's 6. */
export function buildAllInputs() {
    const added = [];
    for (const mode of MODES) {
        for (const variant of VARIANTS) {
            added.push({ baseUrl: PAGE_DATA_TARGET, mode, pageData: true, description: "Check the site.", practices: ["functional"], variant });
        }
    }
    for (const area of COMPREHENSIVE_AREAS) added.push({ baseUrl: PAGE_DATA_TARGET, pageData: true, comprehensive: area });
    return [...buildInputs(), ...added.map((input) => ({ ...input, key: key(input) }))];
}
