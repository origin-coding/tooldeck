import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export default defineConfig({
  cacheDir: ".vite/cache",
  resolve: {
    alias: {
      "@": sourceRoot,
    },
  },
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    sourcemap: true,
    ssr: "src/index.ts",
    target: "node22",
    rollupOptions: {
      external: (id) =>
        nodeBuiltins.has(id) ||
        id.startsWith("node:") ||
        id === "effect" ||
        id.startsWith("effect/"),
      output: {
        codeSplitting: false,
        entryFileNames: "index.js",
        format: "es",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
