// TFP-054: an element discovered but not visible at introspection time is
// not a false claim to make "visible" about - it may be legitimately
// hidden by design until a prerequisite action (a mode switch, an open
// dialog, a different tab), the exact shape behind TFP-040's 7 confirmed
// false positives. Assert only that it exists, and say why nothing
// stronger is claimed. Shared by every builder in this module that walks
// actionable elements (TFP-056, TFP-059 hit the same hidden elements).
export const hiddenAtIntrospectionComment =
    "    // Hidden at introspection time - may require a prerequisite action (e.g. a mode switch, an open dialog, a different tab) before it becomes visible. Asserting only that it exists in the DOM, not that it is currently visible or interactable.";
