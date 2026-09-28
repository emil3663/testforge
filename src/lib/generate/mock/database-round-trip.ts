import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString } from "./format";
import type { ActionableElementDetail, ContentProfile } from "./types";

// TFP-117 (Phase 34, Decision 4): the database area had no template at all -
// only a manual follow-up comment. BEST_PRACTICE_GUIDANCE describes database
// testing as "validate data persistence indirectly through user-visible
// create/read/update flows", so the template writes exactly that: put a
// unique value into a discovered form, save it, reload, and check the value
// is still shown. That is the flow that caught the Phase 21 fixture's
// "note shown once, gone after a reload" defect.
//
// Decision 5: these tests submit real forms on the live site, so they are
// skipped unless the run enables interactive tests - exactly like Phase 19's
// journey tests. Keyword triggering does not bypass it: getBestPracticeAreas
// adds "database" for ordinary words such as "save" and "update".

/** At most this many round trips per suite - one per suitable form. */
const MAX_FORMS = 3;

const SKIP_REASON = `database round trip: saves data through a form on the live site, so it only runs when ${INTERACTIVE_ENV_VAR}=1 is set for the run`;

export interface PersistenceForm {
    path: string;
    field: ActionableElementDetail;
    submit: ActionableElementDetail | null;
}

function fieldName(field: ActionableElementDetail) {
    return field.locator.label || field.locator.name || field.locator.placeholder || field.locator.id;
}

/**
 * A field whose value a site would plausibly store and show again: a plain
 * text input or a textarea, visible, and not a search box (searching is not
 * saving).
 */
function isPersistableField(element: ActionableElementDetail) {
    if (!element.isVisible || !fieldName(element)) return false;
    if (/search/i.test(`${fieldName(element)} ${element.locator.role ?? ""}`)) return false;
    if (element.elementType === "textarea") return true;
    return element.elementType === "input" && (element.locator.inputType === "" || element.locator.inputType === "text");
}

/**
 * Forms worth a persistence round trip, in page order. Introspection lists a
 * form's fields and buttons right after the form itself, so each form is
 * grouped with the form-category elements that follow it. A form with a
 * password field is a sign-in form, not something that saves visible data,
 * and is skipped; so is a form with no persistable field (an email-only
 * signup never shows the address back).
 */
export function findPersistenceForms(contentProfile: ContentProfile | null): PersistenceForm[] {
    const found: PersistenceForm[] = [];
    for (const page of contentProfile?.pages ?? []) {
        const elements = page.actionableElements ?? [];
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].elementType !== "form") continue;
            const group: ActionableElementDetail[] = [];
            for (let j = i + 1; j < elements.length && elements[j].category === "form" && elements[j].elementType !== "form"; j++) {
                group.push(elements[j]);
            }
            if (group.some((element) => element.locator.inputType === "password")) continue;
            const field = group.find(isPersistableField);
            if (!field) continue;
            const submit = group.find((element) => element.elementType === "button" && (element.text || element.locator.name)) ?? null;
            found.push({ path: page.path, field, submit });
            if (found.length >= MAX_FORMS) return found;
        }
    }
    return found;
}

export function buildDatabaseRoundTripTitle(form: PersistenceForm) {
    return `persistence round trip: ${fieldName(form.field)} on ${form.path}`;
}

export function fieldLocator(field: ActionableElementDetail) {
    // `#id` breaks on ids with `.` or `:` or a leading digit; `[id="..."]` is
    // the form locators.ts uses. Escaped twice: once for the CSS string, then
    // for the single-quoted JS string it is written into.
    if (field.locator.id) {
        const selector = `[id="${escapeForDoubleQuotedSelector(field.locator.id)}"]`;
        return `page.locator('${escapeForSingleQuotedString(selector)}')`;
    }
    if (field.locator.label) return `page.getByLabel('${escapeForSingleQuotedString(field.locator.label)}', { exact: true })`;
    if (field.locator.placeholder) return `page.getByPlaceholder('${escapeForSingleQuotedString(field.locator.placeholder)}', { exact: true })`;
    return `page.getByRole('textbox', { name: '${escapeForSingleQuotedString(field.locator.name)}', exact: true })`;
}

function roundTripTest(form: PersistenceForm) {
    const title = escapeForSingleQuotedString(buildDatabaseRoundTripTitle(form));
    const path = escapeForSingleQuotedString(form.path);
    const name = escapeForSingleQuotedString(fieldName(form.field));
    const submitName = form.submit ? escapeForSingleQuotedString(form.submit.text || form.submit.locator.name) : "";
    const submitStep = form.submit
        ? `await form.getByRole('button', { name: '${submitName}' }).first().click();`
        : `await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());`;

    return `  test('${title}', async ({ page }) => {
    test.skip(process.env.${INTERACTIVE_ENV_VAR} !== '1', '${escapeForSingleQuotedString(SKIP_REASON)}');

    // A value no earlier run can have saved, so finding it proves this run saved it.
    const value = \`TestForge check \${Date.now()}\`;
    await page.goto('${path}', { waitUntil: 'domcontentloaded' });
    const field = ${fieldLocator(form.field)};
    await expect(field, 'the "${name}" field on ${path} should be visible').toBeVisible();
    await field.fill(value);
    const form = field.locator('xpath=ancestor::form').first();
    ${submitStep}
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(value).first(), 'after saving, the page should show the value just entered in "${name}" (' + value + '). If this site shows saved entries on a different page, this check does not fit it.').toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(value).first(), 'after a reload the value saved through "${name}" (' + value + ') is gone: it was shown once but not persisted').toBeVisible();
  });`;
}

/** Tests plus the notes that explain them - or why there are none. */
export function buildDatabaseRoundTripTests(contentProfile: ContentProfile | null): { tests: string[]; notes: string[] } {
    if (!contentProfile) {
        return {
            tests: [],
            notes: ["Database: no page inspection data, so no form was found to test a persistence round trip against. Run introspection first."],
        };
    }
    const forms = findPersistenceForms(contentProfile);
    if (forms.length === 0) {
        return {
            tests: [],
            notes: [
                "Database: no form that saves visible text was found on the inspected pages (sign-in forms, search boxes and forms without a text field are left out), so no persistence round trip was generated.",
            ],
        };
    }
    return {
        tests: forms.map(roundTripTest),
        notes: [
            `Database: each test saves a unique value through a discovered form, reloads, and checks the value is still shown. They submit real forms, so they are skipped unless ${INTERACTIVE_ENV_VAR}=1 is set for the run (the "Run interactive tests" option).`,
        ],
    };
}
