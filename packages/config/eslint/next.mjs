// @ts-check
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import globals from "globals";
import { baseConfig } from "./base.mjs";

/**
 * ESLint flat config for SILONYA's Next.js apps (apps/web, apps/admin).
 * Extends the shared base config with React, React Hooks, Next.js, and
 * jsx-a11y rules — accessibility linting is enforced at lint time, not
 * left to manual review (DESIGN_SYSTEM.md §6, PROJECT_RULES.md §6).
 */
export const nextConfig = tseslint.config(
  ...baseConfig,
  {
    // Next.js auto-generates this file on every build/dev run — never hand
    // edited, not worth linting (it's already gitignored).
    ignores: ["next-env.d.ts"],
  },
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
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
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      "react/prop-types": "off",
    },
  },
);

export default nextConfig;
