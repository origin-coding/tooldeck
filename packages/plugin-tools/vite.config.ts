import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
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
      external: (id) => nodeBuiltins.has(id) || id.startsWith("node:"),
      input: {
        index: "src/index.ts",
        "tooldeck-plugin": "src/tooldeck-plugin.ts",
        "generate-command-types": "src/generate-command-types.ts",
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
