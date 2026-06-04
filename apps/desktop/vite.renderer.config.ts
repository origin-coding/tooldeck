import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  cacheDir: ".vite/cache/renderer",
  build: {
    outDir: ".vite/renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
});
