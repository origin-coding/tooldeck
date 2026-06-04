import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  cacheDir: ".vite/cache/renderer",
  build: {
    outDir: ".vite/renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
});
