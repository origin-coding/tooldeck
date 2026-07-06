import { stat } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_PACKAGE_LIMITS,
  TOOLDECK_PACKAGE_EXTENSION,
  TOOLDECK_PACKAGE_MANIFEST_PATH,
  TOOLDECK_PLUGIN_MANIFEST_PATH,
} from "./constants.js";
import { computePackageDigest } from "./digest.js";
import { packageError } from "./errors.js";
import { bytesToText, FflateZipAdapter } from "./fflate-zip-adapter.js";
import { parsePluginManifestText } from "./manifest.js";
import { assertSafePackagePath } from "./paths.js";
import {
  assertPackageFileListMatches,
  validateTooldeckPackageManifest,
} from "./package-manifest.js";
import type {
  ReadTooldeckPackageOptions,
  TooldeckPackageLimits,
  TooldeckPackageSummary,
  UnpackTooldeckPackageOptions,
} from "./types.js";
import type { ZipAdapter } from "./zip-adapter.js";

const defaultZipAdapter = new FflateZipAdapter();

export async function readTooldeckPackage(
  options: ReadTooldeckPackageOptions,
  zipAdapter: ZipAdapter = defaultZipAdapter,
): Promise<TooldeckPackageSummary> {
  assertTooldeckPackageExtension(options.packagePath);
  const limits = resolvePackageLimits(options.limits);
  const archive = await zipAdapter.readArchive(options.packagePath, limits);
  const actualFiles = archive.entries
    .filter((entry) => entry.kind === "file")
    .map((entry) => assertSafePackagePath(entry.path));

  if (!actualFiles.includes(TOOLDECK_PACKAGE_MANIFEST_PATH)) {
    throw packageError("MISSING_PACKAGE_MANIFEST", "Package is missing tooldeck-package.json.", {
      packagePath: options.packagePath,
      entryPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
    });
  }

  if (!actualFiles.includes(TOOLDECK_PLUGIN_MANIFEST_PATH)) {
    throw packageError("MISSING_PLUGIN_MANIFEST", "Package is missing root manifest.json.", {
      packagePath: options.packagePath,
      entryPath: TOOLDECK_PLUGIN_MANIFEST_PATH,
    });
  }

  const packageManifestBytes = await archive.readFile(TOOLDECK_PACKAGE_MANIFEST_PATH);
  const packageManifest = validateTooldeckPackageManifest(
    parseJson(bytesToText(packageManifestBytes), TOOLDECK_PACKAGE_MANIFEST_PATH),
  );
  const files = assertPackageFileListMatches({
    declaredFiles: packageManifest.files,
    actualFiles,
  });

  const pluginManifestBytes = await archive.readFile(TOOLDECK_PLUGIN_MANIFEST_PATH);
  const pluginManifest = parsePluginManifestText(
    bytesToText(pluginManifestBytes),
    TOOLDECK_PLUGIN_MANIFEST_PATH,
  );
  const runtimeEntry = assertSafePackagePath(pluginManifest.runtime.entry, "runtime.entry");

  if (!files.includes(runtimeEntry)) {
    throw packageError("MISSING_RUNTIME_ENTRY", "Package is missing manifest runtime entry.", {
      packagePath: options.packagePath,
      entryPath: runtimeEntry,
      fieldPath: "runtime.entry",
    });
  }

  const archiveStat = await stat(options.packagePath);
  const packageDigest = await computePackageDigest(options.packagePath);
  const uncompressedSizeBytes = archive.entries
    .filter((entry) => entry.kind === "file")
    .reduce((sum, entry) => sum + (entry.uncompressedSizeBytes ?? 0), 0);

  return {
    packagePath: options.packagePath,
    packageDigest,
    packageSizeBytes: archiveStat.size,
    packageManifest,
    pluginManifest,
    files,
    uncompressedSizeBytes,
  };
}

export async function validateTooldeckPackage(
  options: ReadTooldeckPackageOptions,
  zipAdapter?: ZipAdapter,
): Promise<TooldeckPackageSummary> {
  return readTooldeckPackage(options, zipAdapter);
}

export async function unpackTooldeckPackage(
  options: UnpackTooldeckPackageOptions,
  zipAdapter: ZipAdapter = defaultZipAdapter,
): Promise<TooldeckPackageSummary> {
  const summary = await readTooldeckPackage(options, zipAdapter);
  await zipAdapter.extractArchive({
    archivePath: options.packagePath,
    destinationDir: options.destinationDir,
    limits: resolvePackageLimits(options.limits),
  });

  return summary;
}

export function resolvePackageLimits(
  limits: Partial<TooldeckPackageLimits> | undefined,
): TooldeckPackageLimits {
  return {
    ...DEFAULT_PACKAGE_LIMITS,
    ...limits,
  };
}

export function assertTooldeckPackageExtension(packagePath: string): void {
  if (path.extname(packagePath) !== TOOLDECK_PACKAGE_EXTENSION) {
    throw packageError("INVALID_PACKAGE_EXTENSION", "Tooldeck packages must use .tdplugin.", {
      packagePath,
      reason: `got ${path.extname(packagePath) || "<none>"}`,
    });
  }
}

function parseJson(text: string, manifestPath: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw packageError("INVALID_PACKAGE_METADATA", "Package manifest is not valid JSON.", {
      manifestPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
