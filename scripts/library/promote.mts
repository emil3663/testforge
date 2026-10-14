// Phase 42 (TFP-196): the promotion step Claude Code runs. Every candidate Emil approved
// (POST /api/candidates { action: "approve" }) is written, with its evidence, as a library
// entry under src/lib/library/promoted/, and marked promoted in the pool. Then the entries
// are committed and reviewed like any code. Reads the data folder TestForge uses
// (TESTFORGE_DATA_DIR, else the OS app-data folder).
// Usage (from the repo root): npm run library:promote
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { promoteApproved } = await import(pathToFileURL(join(process.cwd(), "src/lib/candidates/promotion.ts")).href);
const written: string[] = await promoteApproved();
console.log(written.length === 0 ? "No approved candidate is waiting for its library commit." : `Library entries written, to review and commit:\n${written.map((file) => `  ${file}`).join("\n")}`);
