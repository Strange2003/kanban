import nextConfig from "eslint-config-next";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = [
  ...nextConfig,
  prettierConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "db/migrations/**",
    ],
  },
];

export default eslintConfig;
