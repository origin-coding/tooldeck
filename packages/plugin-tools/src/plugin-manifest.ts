import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

export const DEFAULT_PLUGIN_MANIFEST_PATH = "manifest.json";

export interface ReadPluginManifestOptions {
  manifestPath?: string;
}

export interface ReadPluginManifestResult {
  manifest: PluginManifest;
  manifestPath: string;
  manifestDir: string;
  sourceLabel: string;
}

export async function readPluginManifest(
  options: ReadPluginManifestOptions = {},
): Promise<ReadPluginManifestResult> {
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);
  const manifestText = await readFile(manifestPath, "utf8");

  return {
    manifest: JSON.parse(manifestText) as PluginManifest,
    manifestPath,
    manifestDir: path.dirname(manifestPath),
    sourceLabel: path.basename(manifestPath),
  };
}
