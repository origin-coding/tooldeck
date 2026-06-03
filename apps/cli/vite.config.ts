import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    sourcemap: true,
    ssr: "src/index.ts",
    target: "node24",
    rollupOptions: {
      external: (id) => nodeBuiltins.has(id) || id.startsWith("node:"),
      output: {
        banner: "#!/usr/bin/env node",
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
