import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["packages/api-types/src/generated/**"],
  options: {
    reportUnusedDisableDirectives: "warn",
  },
});
