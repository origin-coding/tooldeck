import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import {
  formatAuthoringManifestDiagnostics,
  validateAuthoringManifest,
} from "./authoring-json-schema";

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
  const parsed: unknown = JSON.parse(manifestText);
  const validation = validateAuthoringManifest(parsed, manifestPath);

  if (!validation.valid) {
    throw new Error(
      `Manifest is not valid for Tooldeck plugin authoring:\n${formatAuthoringManifestDiagnostics(validation.diagnostics)}`,
    );
  }

  return {
    manifest: validation.manifest,
    manifestPath,
    manifestDir: path.dirname(manifestPath),
    sourceLabel: path.basename(manifestPath),
  };
}
