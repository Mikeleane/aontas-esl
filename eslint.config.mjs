import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Phase 1: legacy typing debt. Tighten during CEFR/data-contract consolidation.
      "@typescript-eslint/no-explicit-any": "off",

      // Presentation/style issues should not block the repaired baseline.
      "react/no-unescaped-entities": "off",

      // Keep this visible, but don't block the baseline build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "public/**",
    "scripts/patches/**",
    "next-env.d.ts",
    ".patch_backups/**",
    "_patch_backups/**",
    "_patch/**",
    "_import_from_kns/**",
    "aontas_esl_v4/**",
    ".wordiness_backups/**",
    "_ui_backup_*/**",
    "**/*.bak*",
  ]),
]);
