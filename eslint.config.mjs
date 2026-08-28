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
]);

export default eslintConfig;
