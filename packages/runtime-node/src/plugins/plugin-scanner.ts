import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import type { ManifestIndex } from "../manifests/manifest-index";
import { parsePluginManifestText } from "../manifests/manifest-validation";

export type PluginScanSourceKind = "builtin" | "installed" | "external";

export interface PluginScanSource {
  kind: PluginScanSourceKind;
  path: string;
}

export interface ScanPluginDirectoryOptions {
  pluginsRoot: string;
  manifestIndex: ManifestIndex;
  kind?: PluginScanSourceKind;
}

export interface ScanPluginSourcesOptions {
  sources: PluginScanSource[];
  manifestIndex: ManifestIndex;
}

export interface ScanPluginDirectoryResult {
  pluginCount: number;
  commandCount: number;
}

export async function scanPluginDirectory(
  options: ScanPluginDirectoryOptions,
): Promise<ScanPluginDirectoryResult> {
  return scanPluginSource({
    source: {
      kind: options.kind ?? "builtin",
      path: options.pluginsRoot,
    },
    manifestIndex: options.manifestIndex,
  });
}

export async function scanPluginSources(
  options: ScanPluginSourcesOptions,
): Promise<ScanPluginDirectoryResult> {
  let pluginCount = 0;
  let commandCount = 0;

  for (const source of options.sources) {
    const result = await scanPluginSource({
      source,
      manifestIndex: options.manifestIndex,
    });

    pluginCount += result.pluginCount;
    commandCount += result.commandCount;
  }

  return {
    pluginCount,
    commandCount,
  };
}

async function scanPluginSource(options: {
  source: PluginScanSource;
  manifestIndex: ManifestIndex;
}): Promise<ScanPluginDirectoryResult> {
  const rootManifestPath = path.join(options.source.path, "manifest.json");
  const rootManifest = await tryReadManifest(rootManifestPath);

  if (rootManifest) {
    return indexPluginManifest({
      manifest: rootManifest,
      manifestIndex: options.manifestIndex,
      manifestPath: rootManifestPath,
      source: options.source,
    });
  }

  let entries;

  try {
    entries = await readdir(options.source.path, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      if (options.source.kind === "installed") {
        return {
          pluginCount: 0,
          commandCount: 0,
        };
      }

      throw new Error(createMissingPluginDirectoryMessage(options.source));
    }

    throw error;
  }

  let pluginCount = 0;
  let commandCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") {
      continue;
    }

    const manifestPath = path.join(options.source.path, entry.name, "manifest.json");
    const manifest = await tryReadManifest(manifestPath);

    if (!manifest) {
      continue;
    }

    const result = indexPluginManifest({
      manifest,
      manifestIndex: options.manifestIndex,
      manifestPath,
      source: options.source,
    });

    pluginCount += result.pluginCount;
    commandCount += result.commandCount;
  }

  return {
    pluginCount,
    commandCount,
  };
}

function indexPluginManifest(options: {
  manifest: PluginManifest;
  manifestIndex: ManifestIndex;
  manifestPath: string;
  source: PluginScanSource;
}): ScanPluginDirectoryResult {
  const commands = options.manifest.contributes?.commands ?? [];

  options.manifestIndex.addPluginManifest({
    manifest: options.manifest,
    manifestPath: options.manifestPath,
    entryPath: path.resolve(path.dirname(options.manifestPath), options.manifest.runtime.entry),
    source: options.source,
  });

  return {
    pluginCount: 1,
    commandCount: commands.length,
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

  return parsePluginManifestText({
    text,
    manifestPath,
  });
}

function createMissingPluginDirectoryMessage(source: PluginScanSource): string {
  if (source.kind === "external") {
    return `External plugin directory does not exist: ${source.path}`;
  }

  return `Plugin directory does not exist: ${source.path}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
