# TFP-240: the template baseline moves to 961f0d8

`961f0d8` changes the template's output on purpose: the sort check's helper
(`tfCheckSorts`, in the control helpers) now reads the list until it shows the
order asked for. This records the new baseline, and that this block is the only
change.

- `npm run check:template-unchanged -- 980346f 961f0d8`: 166 inputs, 162
  identical, 4 different. The 4 are the inputs with page data from the
  comparison fixture, fast and deep, functional and all areas, which carry the
  control helpers.
- In each of the 4, putting the old line back in place of the new block
  (`const items = await tfReadItems(page);`) gives the base output byte for
  byte: 4 of 4. No other line changed.

From here on, `check:template-unchanged` takes `961f0d8` as its base. The
nightly workflow's `TEMPLATE_BASELINE` moves with this record, so tonight's
run compares against it.
