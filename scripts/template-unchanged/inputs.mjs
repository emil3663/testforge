// Phase 35 TFP-137: the fixed inputs the template-unchanged check runs on
// every ref. Exactly the 166 the verifier's scripts used (2026-10-01), so
// results stay comparable with earlier checks; changing this list is its own
// decision. Areas are written out here, not imported from a ref, so both
// sides of a comparison always run the same inputs.

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

function key(input) {
    return [input.pageData ? "page-data" : "no-page-data", input.baseUrl, input.mode, input.description, input.practices.join("+") || "(no areas)"].join(" | ");
}

/** 144 without page data, then 22 with it; each with a stable, readable key. */
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
