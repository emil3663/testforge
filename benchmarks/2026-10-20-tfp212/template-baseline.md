# TFP-212 and TFP-215: the template baseline moves to 2be975c

`be94bff` (TFP-212, TFP-213) and `2be975c` (TFP-215) change the template's output on purpose. Each page's read-only
checks move into one shared-visit group, with the `tfShared` fixture and, in each group, an `expect` that waits 2 s.
This records the new baseline, and that this pass is the only change.

- `npm run check:template-unchanged -- 961f0d8 2be975c`: 166 inputs, 64 identical, 102 different. The 64 are the
  inputs whose suites have no check that can share: no page visit, or areas on Decision 5's fresh-page list only.
- `verify-template.mts`: in each of the 102, the base's output put through `shareReadOnlyVisits` (at `2be975c`) is
  the head's output, byte for byte. 102 of 102; 0 differ in any other way.

From here on, `check:template-unchanged` takes `2be975c` as its base, and the nightly's `TEMPLATE_BASELINE` moves with
this record.
