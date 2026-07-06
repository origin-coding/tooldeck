import {
  TOOLDECK_PACKAGE_FORMAT_VERSION,
  TOOLDECK_PACKAGE_MANIFEST_PATH,
  TOOLDECK_PLUGIN_MANIFEST_PATH,
} from "./constants.js";
import { packageError } from "./errors.js";
import { assertSafePackagePath, dedupeAndSortPackagePaths } from "./paths.js";
import type { TooldeckPackageManifest } from "./types.js";
import { isRecord } from "./utils.js";

export function createTooldeckPackageManifest(options: {
  createdAt?: Date;
  files: Iterable<string>;
}): TooldeckPackageManifest {
  const files = dedupeAndSortPackagePaths([
    TOOLDECK_PLUGIN_MANIFEST_PATH,
    TOOLDECK_PACKAGE_MANIFEST_PATH,
    ...options.files,
  ]);

  return {
    formatVersion: TOOLDECK_PACKAGE_FORMAT_VERSION,
    manifestPath: TOOLDECK_PLUGIN_MANIFEST_PATH,
    createdAt: (options.createdAt ?? new Date()).toISOString(),
    files,
  };
}

export function validateTooldeckPackageManifest(value: unknown): TooldeckPackageManifest {
  if (!isRecord(value)) {
    throw packageError("INVALID_PACKAGE_METADATA", "tooldeck-package.json must be an object.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
    });
  }

  if (value.formatVersion !== TOOLDECK_PACKAGE_FORMAT_VERSION) {
    throw packageError("INVALID_PACKAGE_MANIFEST", "Unsupported Tooldeck package format version.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "formatVersion",
      reason: `expected ${TOOLDECK_PACKAGE_FORMAT_VERSION}`,
    });
  }

  if (value.manifestPath !== TOOLDECK_PLUGIN_MANIFEST_PATH) {
    throw packageError("INVALID_PACKAGE_MANIFEST", "Package manifestPath must be manifest.json.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "manifestPath",
      reason: "1.3 only supports a root manifest.json",
    });
  }

  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    throw packageError("INVALID_PACKAGE_MANIFEST", "Package createdAt must be an ISO date string.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "createdAt",
    });
  }

  if (!Array.isArray(value.files) || !value.files.every((file) => typeof file === "string")) {
    throw packageError("INVALID_PACKAGE_MANIFEST", "Package files must be a string array.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "files",
    });
  }

  const normalizedFiles = value.files.map((file) => assertSafePackagePath(file));
  const files = dedupeAndSortPackagePaths(normalizedFiles);
  if (files.length !== value.files.length) {
    throw packageError("DUPLICATE_FILE_LIST_ENTRY", "Package files must not contain duplicates.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "files",
    });
  }

  for (let index = 0; index < files.length; index += 1) {
    if (normalizedFiles[index] !== files[index]) {
      throw packageError("UNSORTED_FILE_LIST", "Package files must be sorted.", {
        manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
        fieldPath: "files",
        reason: `expected ${files[index]} at index ${index}`,
      });
    }
  }

  for (const requiredPath of [TOOLDECK_PLUGIN_MANIFEST_PATH, TOOLDECK_PACKAGE_MANIFEST_PATH]) {
    assertSafePackagePath(requiredPath);
    if (!files.includes(requiredPath)) {
      throw packageError("INVALID_PACKAGE_MANIFEST", "Package files is missing a required file.", {
        manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
        fieldPath: "files",
        entryPath: requiredPath,
      });
    }
  }

  return {
    formatVersion: TOOLDECK_PACKAGE_FORMAT_VERSION,
    manifestPath: TOOLDECK_PLUGIN_MANIFEST_PATH,
    createdAt: value.createdAt,
    files,
  };
}

export function assertPackageFileListMatches(options: {
  declaredFiles: Iterable<string>;
  actualFiles: Iterable<string>;
}): string[] {
  const declaredFiles = dedupeAndSortPackagePaths(options.declaredFiles);
  const actualFiles = dedupeAndSortPackagePaths(options.actualFiles);

  if (declaredFiles.length !== actualFiles.length) {
    throw packageError("FILE_LIST_MISMATCH", "Package file list does not match ZIP entries.", {
      manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
      fieldPath: "files",
      reason: "file count mismatch",
    });
  }

  for (let index = 0; index < declaredFiles.length; index += 1) {
    if (declaredFiles[index] !== actualFiles[index]) {
      throw packageError("FILE_LIST_MISMATCH", "Package file list does not match ZIP entries.", {
        manifestPath: TOOLDECK_PACKAGE_MANIFEST_PATH,
        fieldPath: "files",
        reason: `expected ${declaredFiles[index]}, got ${actualFiles[index]}`,
      });
    }
  }

  return declaredFiles;
}
