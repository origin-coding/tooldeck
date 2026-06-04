import { defineConfig } from "vite";

import { mainProcessExternal, nodeTarget, sourcemapBuild } from "./vite.shared";

export default defineConfig({
  cacheDir: ".vite/cache/main",
  build: {
    ...sourcemapBuild,
    target: nodeTarget,
    outDir: ".vite/build",
    emptyOutDir: false,
    lib: {
      entry: "src/main/index.ts",
      formats: ["es"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: mainProcessExternal,
    },
  },
});
