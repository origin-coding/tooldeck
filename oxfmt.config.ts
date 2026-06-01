import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  ignorePatterns: ["packages/api-types/src/generated/**"],
  sortImports: true,
  sortTailwindcss: true,
});
