import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString, quoteSelector } from "./format";
import type { ActionableElementDetail, ContentProfile } from "./types";

// Introspection lists a form as a `form` element followed by its fields and
// buttons, with no explicit membership. Shared by the database round trip
// (TFP-117) and the security payload check (TFP-116), so both read forms the
// same way.

export interface DiscoveredForm {
    path: string;
    /** The form's fields and buttons, in page order. */
    elements: ActionableElementDetail[];
}

export function discoverForms(contentProfile: ContentProfile | null): DiscoveredForm[] {
    const forms: DiscoveredForm[] = [];
    for (const page of contentProfile?.pages ?? []) {
        const elements = page.actionableElements ?? [];
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].elementType !== "form") continue;
            const group: ActionableElementDetail[] = [];
            for (let j = i + 1; j < elements.length && elements[j].category === "form" && elements[j].elementType !== "form"; j++) {
                group.push(elements[j]);
            }
            forms.push({ path: page.path, elements: group });
        }
    }
    return forms;
}

export function fieldName(field: ActionableElementDetail) {
    return field.locator.label || field.locator.name || field.locator.placeholder || field.locator.id;
}

/** The form's submit control: the first button with a usable name. */
export function submitButton(form: DiscoveredForm) {
    return form.elements.find((element) => element.elementType === "button" && (element.text || element.locator.name)) ?? null;
}

/** Generated-code locator for a discovered field. */
export function fieldLocator(field: ActionableElementDetail) {
    // `#id` breaks on ids with `.` or `:` or a leading digit; `[id="..."]` is
    // the form locators.ts uses. Escaped twice: once for the CSS string, then
    // for the single-quoted JS string it is written into.
    if (field.locator.id) {
        return `page.locator(${quoteSelector(`[id="${escapeForDoubleQuotedSelector(field.locator.id)}"]`)})`;
    }
    if (field.locator.label) return `page.getByLabel('${escapeForSingleQuotedString(field.locator.label)}', { exact: true })`;
    if (field.locator.placeholder) return `page.getByPlaceholder('${escapeForSingleQuotedString(field.locator.placeholder)}', { exact: true })`;
    return `page.getByRole('textbox', { name: '${escapeForSingleQuotedString(field.locator.name)}', exact: true })`;
}
