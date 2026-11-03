// TFP-258: the fixed inputs, run through one ref's generators. Shared by
// generate.mjs (the check, on each ref) and helper-coverage.test.mjs (on the
// working tree), so the coverage test measures exactly what the check runs.
import { buildAllInputs, withHashRouteLink, withJourney } from "./inputs.mjs";

/** { key: suite } for every fixed input. `modules` are the ref's own, already loaded and checked. */
export function generateOutputs(modules, rawProfile) {
    const { mock, normalize, comprehensive, pages, runMode } = modules;
    // normalizeContentProfile where the ref has it, as the route would apply it.
    const normalized = (raw) => (typeof normalize.normalizeContentProfile === "function" ? normalize.normalizeContentProfile(raw) : raw);
    const profile = normalized(rawProfile);
    const hashRouted = normalized(withHashRouteLink(rawProfile));
    const withJourneys = normalized(withJourney(rawProfile));
    const pageData = { "journeys selected": withJourneys, "a hash-route link": hashRouted };
    const outputs = {};
    for (const input of buildAllInputs()) {
        if (input.comprehensive) {
            // As the generate route builds one: the run mode, then the pages it covers.
            const mode = runMode.normalizeRunMode({ kind: "comprehensive", area: input.comprehensive });
            outputs[input.key] = comprehensive.buildComprehensiveSuite(input.baseUrl, mode, pages.selectComprehensivePages(profile, input.baseUrl, mode.pageCap));
            continue;
        }
        // Every journey the page data has is selected; the route keeps only those its profile still holds.
        const rules = input.variant === "journeys selected" ? { selectedJourneyIds: withJourneys.journeys.map((journey) => journey.id) } : undefined;
        outputs[input.key] = mock.mockGenerate(
            input.baseUrl,
            input.description,
            input.practices,
            input.pageData ? (pageData[input.variant] ?? profile) : null,
            normalize.normalizeContentRules(rules),
            normalize.normalizeTestAuditMode(input.mode)
        );
    }
    return outputs;
}
