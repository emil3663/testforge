# The axe scan last: the template baseline moves to d95fb61

`d95fb61` changes the template's output on purpose: in each page's shared group, the axe scan now runs after the checks
that change the page, not before them (the Gate C ruling, Emil 2026-10-21; `axeOrder` defaults to `"last"`).

This records the new baseline, and that the order is the only change.

- **`npm run check:template-unchanged -- ae4a1ff d95fb61`:** 166 inputs, 120 identical, 46 different. The 46 have a
  page group holding both the axe scan and a check that changes the page.
- **`verify-template.mts`** generates each of the 166 inputs again with this code:
  - with `axeOrder: "before-changes"` (the old default), all 166 are the base's output, byte for byte;
  - by default, all 166 are the head's.
  So the order is the only change.

From here on, `check:template-unchanged` takes `d95fb61` as its base. The nightly's `TEMPLATE_BASELINE` moves with
this record.
