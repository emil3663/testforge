#!/usr/bin/env node
// Phase 48 (TFP-276, Decision 5): the old `testforge` command, until 1.0. One line on stderr, then the same CLI as
// `mr-onion`, with the same exit code.
process.stderr.write("testforge is now mr-onion; the old name stops working at 1.0.\n");
await import("./mr-onion.mjs");
