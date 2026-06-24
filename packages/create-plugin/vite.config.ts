import { builtinModules } from "node:module";

import { defineConfig } from "vite";

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

const externalPackages = new Set(["@clack/prompts", "citty", "consola", "eta", "nypm"]);

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
        "create-tooldeck-plugin": "src/create-tooldeck-plugin.ts",
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
