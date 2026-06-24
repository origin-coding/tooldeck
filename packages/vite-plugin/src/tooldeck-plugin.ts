import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";

import type { Plugin, ResolvedConfig, UserConfig } from "vite";

export interface TooldeckVitePluginOptions {
  manifest?: string;
  entry?: string;
  outDir?: string;
  outputFile?: string;
  target?: string;
  sourcemap?: boolean;
  minify?: boolean;
}

interface TooldeckManifestRuntime {
  kind?: string;
  entry?: string;
}

interface TooldeckManifestShape {
  runtime?: TooldeckManifestRuntime;
}

const DEFAULT_OPTIONS = {
  manifest: "manifest.json",
  entry: "src/index.ts",
  outDir: "dist",
  outputFile: "index.js",
  target: "node22",
  sourcemap: true,
  minify: false,
} as const satisfies Required<TooldeckVitePluginOptions>;

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export function tooldeckPlugin(options: TooldeckVitePluginOptions = {}): Plugin {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  let viteConfig: ResolvedConfig;

  return {
    name: "tooldeck-plugin",
    enforce: "pre",
    config(): UserConfig {
      return {
        cacheDir: ".vite/cache",
        build: {
          emptyOutDir: true,
          minify: resolvedOptions.minify,
          outDir: resolvedOptions.outDir,
          sourcemap: resolvedOptions.sourcemap,
          ssr: resolvedOptions.entry,
          target: resolvedOptions.target,
          rollupOptions: {
            external: (id) => nodeBuiltins.has(id) || id.startsWith("node:"),
            output: {
              codeSplitting: false,
              entryFileNames: resolvedOptions.outputFile,
              format: "es",
            },
          },
        },
        ssr: {
          noExternal: true,
        },
      };
    },
    configResolved(config) {
      viteConfig = config;
    },
    async buildStart() {
      await validateManifest(resolvedOptions, viteConfig.root);
    },
  };
}

async function validateManifest(
  options: Required<TooldeckVitePluginOptions>,
  root: string,
): Promise<void> {
  const manifestPath = path.resolve(root, options.manifest);
  const manifest = await readManifest(manifestPath);

  if (manifest.runtime?.kind !== "node") {
    throw new Error(
      `Tooldeck plugin manifest runtime.kind must be "node" for Vite builds: ${manifestPath}`,
    );
  }

  const expectedEntry = normalizeManifestEntry(path.join(options.outDir, options.outputFile));

  if (manifest.runtime.entry !== expectedEntry) {
    throw new Error(
      `Tooldeck plugin manifest runtime.entry must be "${expectedEntry}" for the configured Vite output: ${manifestPath}`,
    );
  }
}

async function readManifest(manifestPath: string): Promise<TooldeckManifestShape> {
  let text: string;

  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Tooldeck plugin manifest could not be read: ${manifestPath}\n${message}`);
  }

  try {
    return JSON.parse(text) as TooldeckManifestShape;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Tooldeck plugin manifest is not valid JSON: ${manifestPath}\n${message}`);
  }
}

function normalizeManifestEntry(entry: string): string {
  const normalized = entry.replaceAll("\\", "/").replace(/^\.\//, "");

  return `./${normalized}`;
}
