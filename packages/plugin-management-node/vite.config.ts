import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);
const externalPackages = new Set([
  "@tooldeck/plugin-package",
  "@tooldeck/runtime-node",
  "@tooldeck/shared",
  "@tooldeck/storage",
]);

export default defineConfig({
  cacheDir: ".vite/cache",
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    sourcemap: true,
    ssr: "src/index.ts",
    target: "node22",
    rollupOptions: {
      external: (id) =>
        nodeBuiltins.has(id) || id.startsWith("node:") || externalPackages.has(getPackageName(id)),
      output: {
        codeSplitting: false,
        entryFileNames: "index.js",
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
