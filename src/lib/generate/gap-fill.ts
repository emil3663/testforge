import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import { escapeForSingleQuotedString } from "./mock/format";
import { SUITE_TITLES } from "./mock/suite";
import type { BestPracticeArea } from "./mock/types";

// Phase 21 TFP-100, Option B, built in Phase 34 (TFP-118, Decision 6): the
// template always generates; the local model is asked only for the areas the
// template left without a single executable test, and its tests are appended
// inside a block labelled with the model, so a run shows which generator
// wrote which test.

/** Never sent to the local model in this phase: GEN-32 (Phase 33) is still open. */
export const GAP_FILL_EXCLUDED_AREAS: readonly BestPracticeArea[] = ["reliability"];

/** Every local-model block's describe title starts with this. */
export const LOCAL_MODEL_SUITE_PREFIX = "Local model (";

/**
 * Selected or triggered areas where the template wrote zero tests, reliability
 * excluded - and, per GEN-43 (amended Decision 6), not an area the template
 * inspected and correctly found nothing to test: a gap is an area the template
 * could not test, not one where it looked and found nothing applicable.
 */
export function findGapAreas(
    areas: readonly BestPracticeArea[],
    testsByArea: Partial<Record<BestPracticeArea, number>>,
    notApplicable: Partial<Record<BestPracticeArea, string>> = {}
): BestPracticeArea[] {
    return areas.filter((area) => (testsByArea[area] ?? 0) === 0 && !GAP_FILL_EXCLUDED_AREAS.includes(area) && !notApplicable[area]);
}

/**
 * GEN-43 (amended Decision 6): the model's tests ignore the interactive rule -
 * live, one submitted a real login form with interactive tests off - and
 * gap-filling points it at the areas that submit forms. So the whole block is
 * skipped unless interactive tests are on, and reports as "Not run" with this
 * reason. Not per test: recognising a submit in model-written code is exactly
 * where a mistake writes data to a live site.
 */
export function gapFillSkipReason(model: string) {
    return `gap-fill test written by the local model (${model}): it may submit forms on the live site, so it only runs when ${INTERACTIVE_ENV_VAR}=1 is set for the run`;
}

export function localModelSuiteTitle(model: string) {
    return `${LOCAL_MODEL_SUITE_PREFIX}${model})`;
}

/**
 * Appends the local model's suite to the template suite. Its
 * `@playwright/test` import is dropped (the template already has it) and the
 * rest is wrapped in a describe labelled with the model. With exactly one gap
 * area, an inner describe named after that area files its tests under it even
 * if the model forgot its own area block. The merged code is type-checked
 * again by the caller: anything the wrapping can't hold (another import, a
 * clashing top-level name) makes it fail and the template is used alone.
 */
export function mergeLocalSuite(templateCode: string, localCode: string, model: string, gapAreas: readonly BestPracticeArea[]) {
    const body = localCode
        .split("\n")
        .filter((line) => !/^\s*import\s+[^;]*from\s+['"]@playwright\/test['"];?\s*$/.test(line))
        .join("\n")
        .trim();
    const areaBlock = gapAreas.length === 1;
    const indent = areaBlock ? "        " : "    ";
    const indented = body
        .split("\n")
        .map((line) => (line.trim() === "" ? "" : `${indent}${line}`))
        .join("\n");
    const inner = areaBlock
        ? `    test.describe('${escapeForSingleQuotedString(SUITE_TITLES[gapAreas[0]])}', () => {\n${indented}\n    });`
        : indented;

    return `${templateCode}

// Written by the local model (${model}) for the selected areas the template
// generator left without tests: ${gapAreas.join(", ")}. Phase 34, Option B.
test.describe('${escapeForSingleQuotedString(localModelSuiteTitle(model))}', () => {
    test.skip(process.env.${INTERACTIVE_ENV_VAR} !== '1', '${escapeForSingleQuotedString(gapFillSkipReason(model))}');

${inner}
});
`;
}
