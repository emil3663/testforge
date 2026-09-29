import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  {
    ignores: [
      ".next",
      ".next/**",
      "**/.next/**",
      "out",
      "out/**",
      "**/out/**",
      "build",
      "build/**",
      "**/build/**",
      "next-env.d.ts",
      ".playwright-runs",
      ".playwright-runs/**",
      "**/.playwright-runs/**",
      "test-results",
      "test-results/**",
      "**/test-results/**",
      "playwright-report",
      "playwright-report/**",
      "**/playwright-report/**",
      ".venv",
      ".venv/**",
      "**/.venv/**",
      "skills",
      "skills/**",
      "**/skills/**",
      // Runtime-generated, gitignored output (persisted runs / artifacts) -
      // same scoping gap TFP-078 fixed for skills/, found once a real
      // generate+run cycle (TFP-082's live verification) actually
      // populated runs/ with a generated suite.spec.ts to lint.
      "runs",
      "runs/**",
      "**/runs/**",
      "artifacts",
      "artifacts/**",
      "**/artifacts/**",
      // Phase 36 (TFP-126): suites the local-model benchmark recorded. They
      // are measured model output, kept as written - including ones that
      // fail TestForge's own gates - not project code.
      "benchmarks/**/*.spec.ts",
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // TFP-080: dom-snapshot.ts's captureDomSnapshot is passed by reference
    // to Playwright's page.evaluate() (see src/lib/introspect/inspector.ts),
    // which serializes the function's own source and runs it inside the
    // browser's isolated JS context - every helper it uses must stay nested
    // inside its body, since no module system is available at runtime
    // there. Splitting the file would silently break real page
    // introspection. A single, named exception, not a general loosening of
    // the rule - see the file's own header comment for the full rationale.
    files: ["src/lib/introspect/dom-snapshot.ts"],
    rules: {
      "max-lines": "off",
    },
  },
]);

export default eslintConfig;
