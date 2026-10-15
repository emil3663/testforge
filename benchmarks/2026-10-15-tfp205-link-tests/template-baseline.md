# TFP-205: the template baseline, updated for the added link tests

`npm run check:template-unchanged -- 78a64fb` on the code with TFP-205, then `verify-template.mts 78a64fb-worktree`: each added link test taken out of the new output, what is left compared byte for byte with the old.

**166 inputs: 162 identical, 4 differing only by the added link tests (16 tests in all), 0 with any other change.**

| Input | Added link tests |
| --- | --- |
| page-data \| http://127.0.0.1:4410 \| fast \| Check the site. \| functional | 4 |
| page-data \| http://127.0.0.1:4410 \| fast \| Check the site. \| (no areas) | 4 |
| page-data \| http://127.0.0.1:4410 \| deep \| Check the site. \| functional | 4 |
| page-data \| http://127.0.0.1:4410 \| deep \| Check the site. \| (no areas) | 4 |
