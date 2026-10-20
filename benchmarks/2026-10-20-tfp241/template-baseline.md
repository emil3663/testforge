# TFP-241: the template baseline moves to 3b1210c

`3b1210c` changes the template's output on purpose, in two places:
- **The shared-visit helper:** it records the visit's video and keeps it for a failing check.
- **Each page's group:** it gains one line, an `afterAll` that ends its visit.

This records the new baseline, and that these are the only changes.

- **`npm run check:template-unchanged -- 2be975c 3b1210c`:** 166 inputs, 64 identical, 102 different. The 64 have no
  check that shares a visit.
- **`verify-template.mts`:** in each of the 102, the base's output with `2be975c`'s helper replaced by `3b1210c`'s, and
  the `afterAll` line added after each group's `const expect = tfSharedExpect;`, is the head's output, byte for byte.
  102 of 102; 0 differ in any other way.

From here on, `check:template-unchanged` takes `3b1210c` as its base. The nightly's `TEMPLATE_BASELINE` moves with
this record.
