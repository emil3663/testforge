# TFP-211: the numbers

Each cell: the median of the three runs, then (min to max) when they differ. Times in seconds.

## fixture, standard (3 runs)

| Number | Value |
| --- | --- |
| Run time | 178 (177 to 178) |
| Tests | 123 |
| Test time (sum) | 167 (166 to 167) |
| Page loads: count | 125 |
| Page loads: time | 39 |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 128 |
| Settle waits: time | 62 |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 22; 2 |
| Failing tests: count | 9 |
| Failing tests: time | 23 |
| Failing tests: time in failed steps | 15 |
| Pages loaded (distinct) | 3 |
| Loads per distinct page | 41.7 |
| Failures in every run / in some runs only | 9 / 0 |

Page loads by page and area (run 1, 3 pages):

| Page | accessibility | cookie/session | functional | performance/load | reliability | responsive/mobile | security | seo/content | usability | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 8 | 1 | 22 | 6 | 1 | 4 | 4 | 8 | 5 | 59 |
| /login | 4 | 0 | 15 | 0 | 1 | 0 | 4 | 6 | 4 | 34 |
| /notes | 4 | 0 | 14 | 0 | 0 | 0 | 4 | 6 | 4 | 32 |

Loads named from the suite's route lists (run 1): 0 of 125.

The link checks (run 1):

| Check | Tests | Loads | Requests | Time (s) | Distinct targets |
| --- | --- | --- | --- | --- | --- |
| navigation links | 9 | 9 | 9 | 11 | 3 |
| link health | 3 | 0 | 10 | 0 | 3 |
| link tests | 4 | 4 | 0 | 4 | 0 |

The link checks' time, every run:

| Check | Time (s) |
| --- | --- |
| navigation links | 11 |
| link health | 0 |
| link tests | 4 |

| Checks | Targets shared |
| --- | --- |
| navigation links and link health | 3 |
| navigation links and link tests | 0 |
| link health and link tests | 0 |

Targets reached by two or more checks: 3 (/: navigation links, link health; /login: navigation links, link health; /notes: navigation links, link health).

Controls by Decision 3's kinds (inspection):

| Page | In place | In-app navigation | Path navigation | Unclear |
| --- | --- | --- | --- | --- |
| / | 0 | 0 | 4 | 0 |
| /login | 0 | 0 | 3 | 4 |
| /notes | 0 | 0 | 3 | 3 |

## fixture, security (3 runs)

| Number | Value |
| --- | --- |
| Run time | 22 |
| Tests | 20 |
| Test time (sum) | 20 |
| Page loads: count | 19 |
| Page loads: time | 7 |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 19 |
| Settle waits: time | 10 (9 to 10) |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 20; 0 |
| Failing tests: count | 0 |
| Failing tests: time | 0 |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 3 |
| Loads per distinct page | 6.3 |
| Failures in every run / in some runs only | 0 / 0 |

## fixture, accessibility (3 runs)

| Number | Value |
| --- | --- |
| Run time | 16 |
| Tests | 12 |
| Test time (sum) | 14 |
| Page loads: count | 12 |
| Page loads: time | 4 |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 12 |
| Settle waits: time | 6 |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 0; 0 |
| Failing tests: count | 0 |
| Failing tests: time | 0 |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 3 |
| Loads per distinct page | 4 |
| Failures in every run / in some runs only | 0 / 0 |

## with-bugs, standard (3 runs)

| Number | Value |
| --- | --- |
| Run time | 1486 (1464 to 1511) |
| Tests | 483 |
| Test time (sum) | 1350 (1332 to 1371) |
| Page loads: count | 563 (561 to 566) |
| Page loads: time | 202 (200 to 210) |
| about:blank loads: count, time | 357; 6 (6 to 7) |
| Settle waits: count | 583 (581 to 586) |
| Settle waits: time | 608 (605 to 612) |
| Settle waits at the 5 s cap: count, time | 3 (0 to 4); 14 (0 to 17) |
| Requests: count, time | 71; 21 (16 to 32) |
| Failing tests: count | 84 |
| Failing tests: time | 468 (454 to 477) |
| Failing tests: time in failed steps | 137 |
| Pages loaded (distinct) | 15 (14 to 17) |
| Loads per distinct page | 37.5 (33.3 to 40.1) |
| Failures in every run / in some runs only | 84 / 0 |

Page loads by page and area (run 1, 17 pages):

| Page | accessibility | cookie/session | functional | performance/load | reliability | responsive/mobile | security | seo/content | usability | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (missing-route probe) | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| / | 41 | 1 | 66 | 6 | 0 | 4 | 0 | 2 | 23 | 143 |
| /#/ | 4 | 0 | 22 | 0 | 3 | 0 | 4 | 6 | 4 | 43 |
| /#/auth/forgot-password | 4 | 0 | 19 | 0 | 2 | 0 | 4 | 6 | 4 | 39 |
| /#/auth/login | 4 | 0 | 27 | 0 | 2 | 0 | 4 | 6 | 4 | 47 |
| /#/auth/register | 4 | 0 | 31 | 0 | 2 | 0 | 4 | 6 | 4 | 51 |
| /#/category/hand-tools | 4 | 0 | 44 | 0 | 2 | 0 | 4 | 6 | 4 | 64 |
| /#/category/power-tools | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| /#/category/undefined | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| /#/chainsaws | 3 | 0 | 24 | 0 | 2 | 0 | 4 | 6 | 4 | 43 |
| /#/contact | 4 | 0 | 32 | 0 | 2 | 0 | 4 | 6 | 4 | 52 |
| /#/product/1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| /#/product/2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| /#/product/6 | 4 | 0 | 27 | 0 | 2 | 0 | 4 | 6 | 4 | 47 |
| /#/product/7 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| /#/product/8 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| /#/rentals | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |

Loads named from the suite's route lists (run 1): 66 of 566.

The link checks (run 1):

| Check | Tests | Loads | Requests | Time (s) | Distinct targets |
| --- | --- | --- | --- | --- | --- |
| navigation links | 24 | 48 | 8 | 98 | 3 |
| link health | 8 | 0 | 34 | 8 | 6 |
| linked routes | 8 | 66 | 0 | 115 | 12 |
| link tests | 22 | 22 | 0 | 47 | 0 |

The link checks' time, every run:

| Check | Time (s) |
| --- | --- |
| navigation links | 98 (97 to 107) |
| link health | 7 (6 to 8) |
| linked routes | 115 (115 to 124) |
| link tests | 47 (47 to 49) |

| Checks | Targets shared |
| --- | --- |
| navigation links and link health | 1 |
| navigation links and linked routes | 2 |
| navigation links and link tests | 0 |
| link health and linked routes | 0 |
| link health and link tests | 0 |
| linked routes and link tests | 0 |

Targets reached by two or more checks: 3 (/: navigation links, link health; /#/category/hand-tools: navigation links, linked routes; /#/contact: navigation links, linked routes).

Controls by Decision 3's kinds (inspection):

| Page | In place | In-app navigation | Path navigation | Unclear |
| --- | --- | --- | --- | --- |
| /#/ | 24 | 17 | 1 | 9 |
| /#/product/6 | 3 | 14 | 1 | 12 |
| /#/category/hand-tools | 19 | 17 | 1 | 6 |
| /#/auth/register | 2 | 8 | 1 | 19 |
| /#/contact | 2 | 8 | 1 | 13 |
| /#/auth/login | 2 | 10 | 1 | 10 |
| /#/auth/forgot-password | 2 | 8 | 1 | 8 |
| /#/chainsaws | 2 | 8 | 1 | 5 |

## with-bugs, security (3 runs)

| Number | Value |
| --- | --- |
| Run time | 240 (239 to 247) |
| Tests | 122 |
| Test time (sum) | 231 (230 to 238) |
| Page loads: count | 121 |
| Page loads: time | 43 (43 to 44) |
| about:blank loads: count, time | 121; 2 |
| Settle waits: count | 121 |
| Settle waits: time | 124 (123 to 126) |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 39; 5 (3 to 5) |
| Failing tests: count | 3 |
| Failing tests: time | 12 (12 to 13) |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 20 |
| Loads per distinct page | 6.1 |
| Failures in every run / in some runs only | 3 / 0 |

## with-bugs, accessibility (3 runs)

| Number | Value |
| --- | --- |
| Run time | 245 (237 to 247) |
| Tests | 80 |
| Test time (sum) | 187 (180 to 188) |
| Page loads: count | 80 |
| Page loads: time | 27 |
| about:blank loads: count, time | 80; 1 |
| Settle waits: count | 80 |
| Settle waits: time | 83 (78 to 86) |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 0; 0 |
| Failing tests: count | 41 |
| Failing tests: time | 117 (113 to 118) |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 20 |
| Loads per distinct page | 4 |
| Failures in every run / in some runs only | 41 / 0 |

## clean, standard (3 runs)

| Number | Value |
| --- | --- |
| Run time | 1231 (1192 to 1252) |
| Tests | 472 |
| Test time (sum) | 1134 (1096 to 1152) |
| Page loads: count | 474 |
| Page loads: time | 147 (139 to 147) |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 496 |
| Settle waits: time | 550 (538 to 557) |
| Settle waits at the 5 s cap: count, time | 0 (0 to 2); 0 (0 to 10) |
| Requests: count, time | 185; 18 |
| Failing tests: count | 47 (47 to 48) |
| Failing tests: time | 222 (216 to 229) |
| Failing tests: time in failed steps | 96 |
| Pages loaded (distinct) | 8 |
| Loads per distinct page | 59.3 |
| Failures in every run / in some runs only | 47 / 1 |

Failing in some runs only:
- TFFU-218: sort options order the items on /category/hand-tools (run 2)

Page loads by page and area (run 1, 8 pages):

| Page | accessibility | cookie/session | functional | performance/load | reliability | responsive/mobile | security | seo/content | usability | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 45 | 1 | 56 | 6 | 4 | 4 | 4 | 8 | 19 | 147 |
| /auth/forgot-password | 4 | 0 | 21 | 0 | 2 | 0 | 4 | 6 | 4 | 41 |
| /auth/login | 4 | 0 | 25 | 0 | 2 | 0 | 4 | 6 | 4 | 45 |
| /auth/register | 4 | 0 | 33 | 0 | 2 | 0 | 4 | 6 | 4 | 53 |
| /category/hand-tools | 4 | 0 | 35 | 0 | 2 | 0 | 4 | 6 | 4 | 55 |
| /contact | 4 | 0 | 27 | 0 | 2 | 0 | 4 | 6 | 4 | 47 |
| /product/01M5B8BW4J367TMA87J1A9RWJM | 4 | 0 | 29 | 0 | 2 | 0 | 4 | 6 | 4 | 49 |
| /rentals | 3 | 0 | 18 | 0 | 2 | 0 | 4 | 6 | 4 | 37 |

Loads named from the suite's route lists (run 1): 0 of 474.

The link checks (run 1):

| Check | Tests | Loads | Requests | Time (s) | Distinct targets |
| --- | --- | --- | --- | --- | --- |
| navigation links | 24 | 24 | 24 | 44 | 2 |
| link health | 8 | 0 | 132 | 8 | 30 |
| link tests | 21 | 21 | 0 | 44 | 0 |

The link checks' time, every run:

| Check | Time (s) |
| --- | --- |
| navigation links | 48 (44 to 51) |
| link health | 8 |
| link tests | 44 (41 to 55) |

| Checks | Targets shared |
| --- | --- |
| navigation links and link health | 2 |
| navigation links and link tests | 0 |
| link health and link tests | 0 |

Targets reached by two or more checks: 2 (/: navigation links, link health; /category/hand-tools: navigation links, link health).

Controls by Decision 3's kinds (inspection):

| Page | In place | In-app navigation | Path navigation | Unclear |
| --- | --- | --- | --- | --- |
| / | 16 | 0 | 19 | 10 |
| /product/01M5B8BW4J367TMA87J1A9RWJM | 4 | 0 | 16 | 13 |
| /category/hand-tools | 17 | 0 | 19 | 6 |
| /auth/register | 3 | 0 | 10 | 20 |
| /contact | 3 | 0 | 10 | 14 |
| /auth/login | 3 | 0 | 12 | 11 |
| /auth/forgot-password | 3 | 0 | 10 | 9 |
| /rentals | 3 | 0 | 10 | 6 |

## clean, security (3 runs)

| Number | Value |
| --- | --- |
| Run time | 229 (223 to 233) |
| Tests | 122 |
| Test time (sum) | 220 (215 to 224) |
| Page loads: count | 121 |
| Page loads: time | 38 (36 to 39) |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 121 |
| Settle waits: time | 131 (124 to 133) |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 39; 4 (3 to 8) |
| Failing tests: count | 2 |
| Failing tests: time | 4 |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 20 |
| Loads per distinct page | 6.1 |
| Failures in every run / in some runs only | 2 / 0 |

## clean, accessibility (3 runs)

| Number | Value |
| --- | --- |
| Run time | 245 (228 to 283) |
| Tests | 80 |
| Test time (sum) | 203 (188 to 237) |
| Page loads: count | 80 |
| Page loads: time | 24 (24 to 29) |
| about:blank loads: count, time | 0; 0 |
| Settle waits: count | 80 |
| Settle waits: time | 90 (84 to 101) |
| Settle waits at the 5 s cap: count, time | 0; 0 |
| Requests: count, time | 0; 0 |
| Failing tests: count | 19 |
| Failing tests: time | 75 (70 to 86) |
| Failing tests: time in failed steps | 0 |
| Pages loaded (distinct) | 20 |
| Loads per distinct page | 4 |
| Failures in every run / in some runs only | 19 / 0 |

