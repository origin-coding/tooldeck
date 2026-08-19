import { defineConfig } from "vite";

const externalPackages = new Set(["@tooldeck/protocol", "ajv"]);

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
      external: (id) => externalPackages.has(getPackageName(id)),
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
