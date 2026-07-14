// @ts-check
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import globals from "globals";
import { baseConfig } from "./base.mjs";

/**
 * ESLint flat config for framework-agnostic React packages (packages/ui,
 * packages/emails) — React, hooks, and accessibility rules without any
 * Next.js-specific plugin, since these packages are not Next.js apps
 * themselves (TECH_STACK.md §3).
 */
export const reactConfig = tseslint.config(...baseConfig, {
  plugins: {
    react: reactPlugin,
    "react-hooks": reactHooksPlugin,
    "jsx-a11y": jsxA11yPlugin,
  },
  languageOptions: {
    globals: {
      ...globals.browser,
    },
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactPlugin.configs["jsx-runtime"].rules,
    ...reactHooksPlugin.configs.recommended.rules,
    ...jsxA11yPlugin.configs.recommended.rules,
    "react/prop-types": "off",
  },
});

export default reactConfig;
