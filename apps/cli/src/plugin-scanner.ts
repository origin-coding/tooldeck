import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ManifestIndex } from "@tooldeck/core";
import type { PluginManifest } from "@tooldeck/protocol";

export interface ScanPluginDirectoryOptions {
  pluginsRoot: string;
  manifestIndex: ManifestIndex;
}

export async function scanPluginDirectory(options: ScanPluginDirectoryOptions): Promise<void> {
  const entries = await readdir(options.pluginsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(options.pluginsRoot, entry.name, "manifest.json");
    const manifest = await tryReadManifest(manifestPath);

    if (!manifest) {
      continue;
    }

    const entryPath = path.resolve(path.dirname(manifestPath), manifest.runtime.entry);

    options.manifestIndex.addPluginManifest({
      manifest,
      manifestPath,
      entryPath,
    });
  }
}

async function tryReadManifest(manifestPath: string): Promise<PluginManifest | undefined> {
  let text: string;

  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  return JSON.parse(text) as PluginManifest;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
