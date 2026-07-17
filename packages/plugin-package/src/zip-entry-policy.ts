import { packageError } from "./errors.js";
import { assertSafePackagePath } from "./paths.js";
import type { TooldeckPackageLimits } from "./types.js";
import type { CentralDirectoryEntry } from "./zip-central-directory.js";

export function validateZipEntries(
  entries: CentralDirectoryEntry[],
  limits: TooldeckPackageLimits,
): void {
  let regularFileCount = 0;
  let uncompressedSizeBytes = 0;

  for (const entry of entries) {
    assertSafePackagePath(entry.path);

    if (entry.encrypted) {
      throw packageError("UNSUPPORTED_ENCRYPTED_ZIP", "Encrypted ZIP entries are not supported.", {
        entryPath: entry.path,
      });
    }

    if (entry.compression !== 0 && entry.compression !== 8) {
      throw packageError("UNSUPPORTED_ZIP_ENTRY", "Unsupported ZIP compression method.", {
        entryPath: entry.path,
        reason: `compression method ${entry.compression}`,
      });
    }

    if (entry.kind !== "file" && entry.kind !== "directory") {
      throw packageError("UNSUPPORTED_ZIP_ENTRY", "Only regular files are supported in packages.", {
        entryPath: entry.path,
        reason: entry.kind,
      });
    }

    if (entry.kind === "file") {
      regularFileCount += 1;
      uncompressedSizeBytes += entry.uncompressedSizeBytes ?? 0;
    }
  }

  if (regularFileCount > limits.maxRegularFileCount) {
    throw packageError("TOO_MANY_FILES", "Tooldeck package contains too many files.", {
      reason: `${regularFileCount} > ${limits.maxRegularFileCount}`,
    });
  }

  if (uncompressedSizeBytes > limits.maxUncompressedSizeBytes) {
    throw packageError(
      "UNCOMPRESSED_SIZE_TOO_LARGE",
      "Tooldeck package is too large after unzip.",
      {
        reason: `${uncompressedSizeBytes} > ${limits.maxUncompressedSizeBytes}`,
      },
    );
  }
}
