# TFP-214: the template baseline moves to ae4a1ff

`ae4a1ff` changes the template's output on purpose, in two ways:
- **The shared-visit pass shares more checks.** A check that changes its page in place now shares the visit:
  - it calls `tfShared.changed()` and runs inside `tfShared.rerun()`;
  - it runs after its page's reads and the axe scan.
  The helper the pass adds changed with it: Back after a check leaves the page, and the re-run in the same attempt.
- **The navigation check's helper (`tfCheckNavLinks`)** comes back to its start page by Back, and fails a link that
  moves the address while the page still shows the start's content.

This records the new baseline, and that these are the only changes.

- **`npm run check:template-unchanged -- 3b1210c ae4a1ff`:** 166 inputs, 64 identical,
  102 different. The 64 have no check that shares a visit.
- **`verify-template.mts`** generates each ref's output again with the pass off (`{ sharedVisits: false }`):
  - with the pass on, both refs' outputs are check:template-unchanged's, 166 of 166;
  - with the pass off, 162 are identical and 4 differ by `tfCheckNavLinks` alone (the base's, with its helper replaced
    by the head's, is the head's, byte for byte); 0 differ in any other way.
  So no check's own code changed but the navigation helper, and the rest of the difference is the pass's.
- **Checks on a shared visit, over all 166 inputs:** 782 before, 910 after; 104 of them change the page (in `rerun()`).

From here on, `check:template-unchanged` takes `ae4a1ff` as its base. The nightly's `TEMPLATE_BASELINE` moves with
this record.
