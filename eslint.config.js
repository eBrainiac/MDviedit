// RULE-001 / CFG-002: prohíbe literales numéricos en componentes (permitidos
// 0, 1, -1); los valores de UI viven en src/config/*. CI falla si hay
// hallazgos (AT-090).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".svelte-kit/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "node_modules/**",
      "static/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  {
    // Módulos de estado con runes (Svelte 5): eslint-plugin-svelte también
    // los enruta por svelte-eslint-parser, que necesita el sub-parser TS.
    files: ["**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ["**/*.{ts,svelte}"],
    rules: {
      "no-magic-numbers": [
        "error",
        { ignore: [0, 1, -1], ignoreArrayIndexes: true, enforceConst: false },
      ],
    },
  },
  {
    // Capa de tokens/config (ADR-006): única fuente permitida de literales.
    files: ["src/config/**", "scripts/**", "*.config.{js,ts}", "vite.config.js"],
    rules: {
      "no-magic-numbers": "off",
    },
  },
  {
    // Los asserts de prueba (toHaveLength(3), índices de array, etc.) no
    // son literales de UI — RULE-001/CFG-002 no aplica a los tests.
    files: ["**/*.test.ts"],
    rules: {
      "no-magic-numbers": "off",
    },
  },
);
