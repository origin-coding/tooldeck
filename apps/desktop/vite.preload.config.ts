import { defineConfig } from "vite";

import { nodeTarget, sourcemapBuild } from "./vite.shared";

export default defineConfig({
  cacheDir: ".vite/cache/preload",
  build: {
    ...sourcemapBuild,
    target: nodeTarget,
    outDir: ".vite/build",
    emptyOutDir: false,
    lib: {
      entry: "src/preload/index.ts",
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
