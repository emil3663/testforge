import { isComprehensive } from "@/lib/comprehensive/run-mode";
import { selectComprehensivePages } from "@/lib/comprehensive/pages";
import { buildComprehensiveSuite } from "@/lib/generate/comprehensive";
import { mockGenerate } from "@/lib/generate/mock";
import type { ContentProfile } from "@/lib/generate/mock/types";
import type { SiteSuiteInputs } from "./store";

/**
 * Phase 42 (TFP-191): the template's suite for saved inputs - what POST
 * /api/generate writes before the site suite is applied: Comprehensive's
 * suite for its area and pages, or the Standard template's.
 */
export function templateSuite(inputs: SiteSuiteInputs, profile: ContentProfile | null): string {
    if (isComprehensive(inputs.runMode)) {
        return buildComprehensiveSuite(inputs.baseUrl, inputs.runMode, selectComprehensivePages(profile, inputs.baseUrl, inputs.runMode.pageCap));
    }
    return mockGenerate(inputs.baseUrl, inputs.description, inputs.practices, profile, inputs.contentRules, inputs.auditMode);
}
