// apps/desktop/vite.renderer.config.ts
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  cacheDir: ".vite/cache/renderer",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: ".vite/renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
});
