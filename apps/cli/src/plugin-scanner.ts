import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ManifestIndex } from "@tooldeck/core";
import type { PluginManifest } from "@tooldeck/protocol";
import { consola } from "consola";

export interface ScanPluginDirectoryOptions {
  pluginsRoot: string;
  manifestIndex: ManifestIndex;
}

export interface ScanPluginDirectoryResult {
  pluginCount: number;
  commandCount: number;
}

export async function scanPluginDirectory(
  options: ScanPluginDirectoryOptions,
): Promise<ScanPluginDirectoryResult> {
  let entries;

  try {
    entries = await readdir(options.pluginsRoot, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Plugin directory does not exist: ${options.pluginsRoot}`);
    }

    throw error;
  }

  let pluginCount = 0;
  let commandCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(options.pluginsRoot, entry.name, "manifest.json");
    const manifest = await tryReadManifest(manifestPath);

    if (!manifest) {
      consola.warn(`Skipping plugin directory without manifest: ${path.dirname(manifestPath)}`);
      continue;
    }

    const entryPath = path.resolve(path.dirname(manifestPath), manifest.runtime.entry);
    const commands = manifest.contributes?.commands ?? [];

    options.manifestIndex.addPluginManifest({
      manifest,
      manifestPath,
      entryPath,
    });

    pluginCount += 1;
    commandCount += commands.length;
  }

  return {
    pluginCount,
    commandCount,
  };
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
