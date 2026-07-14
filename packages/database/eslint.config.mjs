import { baseConfig } from "@silonya/config/eslint/base";

export default [
  ...baseConfig,
  {
    ignores: ["generated/**"],
  },
];
