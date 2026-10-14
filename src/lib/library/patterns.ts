import type { ContentProfilePage } from "@/lib/generate/mock/types";

/**
 * Phase 42 (TFP-193, Decision 2): the component patterns the library's
 * entries match, read from what inspection recorded on a page. Moved here
 * from the controls check (TFP-182), where they decided which pages got
 * which check; the decision is now the library's.
 */

const SORT_WORDS = /\b(a\s*(-|–|to)\s*z|z\s*(-|–|to)\s*a|low(est)?\s*(-|–|to)\s*high(est)?|high(est)?\s*(-|–|to)\s*low(est)?|ascending|descending)\b/gi;

function elements(page: ContentProfilePage) {
    return page.actionableElements ?? [];
}

/** A list whose options name two orders or more ("Name (A - Z)", "Price (Low - High)"). */
export function hasSortSelect(page: ContentProfilePage) {
    return elements(page).some((element) => element.elementType === "select" && (element.text.match(SORT_WORDS) ?? []).length >= 2);
}

/** Any list. */
export function hasSelect(page: ContentProfilePage) {
    return elements(page).some((element) => element.elementType === "select");
}

/** A checkbox or a range field: an option filter or a slider. */
export function hasFilterField(page: ContentProfilePage) {
    return elements(page).some((element) => element.elementType === "input" && ["checkbox", "range"].includes(element.locator.inputType));
}

/** A number field: a quantity stepper's. */
export function hasNumberField(page: ContentProfilePage) {
    return elements(page).some((element) => element.elementType === "input" && (element.locator.inputType === "number" || element.locator.role === "spinbutton"));
}

/** Every inspected page: a check of the page as a whole (its layout, its text, its tab order). */
export function anyPage() {
    return true;
}
