import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

const externalPackages = new Set([
  "@tooldeck/protocol",
  "ajv",
  "citty",
  "json-schema-to-typescript",
  "scule",
]);

export default defineConfig({
  cacheDir: ".vite/cache",
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    sourcemap: true,
    ssr: true,
    target: "node22",
    rollupOptions: {
      external: (id) =>
        nodeBuiltins.has(id) || id.startsWith("node:") || externalPackages.has(getPackageName(id)),
      input: {
        index: "src/index.ts",
        testing: "src/testing.ts",
        "tooldeck-plugin": "src/tooldeck-plugin.ts",
        "generate-command-types": "src/bin/generate-command-types.ts",
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
});

function getPackageName(id: string): string {
  if (id.startsWith("@")) {
    return id.split("/").slice(0, 2).join("/");
  }

  return id.split("/")[0] ?? id;
}
