import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

import { packageError } from "./errors.js";
import { assertSafePackagePath, normalizePackagePath } from "./paths.js";
import type { TooldeckPackageLimits } from "./types.js";
import type {
  ZipAdapter,
  ZipEntryKind,
  ZipEntryMetadata,
  ZipReadArchive,
  ZipWriteEntry,
} from "./zip-adapter.js";

interface CentralDirectoryEntry extends ZipEntryMetadata {
  compression: number;
  encrypted: boolean;
}

// ZIP signatures and sentinel values are defined by the PKWARE APPNOTE spec.
// End of Central Directory record signature: 0x06054b50 ("PK\x05\x06").
const EOCD_SIGNATURE = 0x06054b50;
// ZIP64 End of Central Directory Locator signature: 0x07064b50 ("PK\x06\x07").
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
// Central Directory File Header signature: 0x02014b50 ("PK\x01\x02").
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
// EOCD comments are length-prefixed with uint16, so the maximum comment is 65,535 bytes.
const MAX_EOCD_COMMENT_BYTES = 0xffff;
// ZIP64 uses all-ones 16-bit and 32-bit values as sentinels in classic ZIP fields.
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

export class FflateZipAdapter implements ZipAdapter {
  async readArchive(archivePath: string, limits: TooldeckPackageLimits): Promise<ZipReadArchive> {
    await assertPackageFileSize(archivePath, limits);
    const data = await readPackageFile(archivePath);
    const entries = parseCentralDirectory(data);

    validateEntries(entries, limits);

    return {
      entries,
      readFile: async (entryPath) => {
        const normalizedPath = assertSafePackagePath(entryPath);
        const files = unzipSingleFile(data, normalizedPath);
        const file = files[normalizedPath];

        if (!file) {
          throw packageError("FILE_LIST_MISMATCH", "ZIP entry does not exist.", {
            packagePath: archivePath,
            entryPath: normalizedPath,
          });
        }

        return file;
      },
    };
  }

  async writeArchive(archivePath: string, entries: ZipWriteEntry[]): Promise<void> {
    const zippable: Zippable = {};

    for (const entry of entries) {
      const normalizedPath = assertSafePackagePath(entry.path);
      zippable[normalizedPath] = [entry.data, { level: 6 }];
    }

    let data: Uint8Array;

    try {
      data = zipSync(zippable);
    } catch (error) {
      throw packageError("PACKAGE_WRITE_FAILED", "Tooldeck package could not be created.", {
        packagePath: archivePath,
        reason: formatUnknownError(error),
      });
    }

    await writePackageFile(archivePath, data);
  }

  async extractArchive(options: {
    archivePath: string;
    destinationDir: string;
    limits: TooldeckPackageLimits;
  }): Promise<void> {
    await assertPackageFileSize(options.archivePath, options.limits);
    const data = await readPackageFile(options.archivePath);
    const entries = parseCentralDirectory(data);
    validateEntries(entries, options.limits);

    let files: Record<string, Uint8Array>;

    try {
      files = unzipSync(data);
    } catch (error) {
      throw packageError("PACKAGE_EXTRACT_FAILED", "Tooldeck package could not be extracted.", {
        packagePath: options.archivePath,
        reason: formatUnknownError(error),
      });
    }
    const destinationDir = path.resolve(options.destinationDir);
    await createExtractionDirectory(destinationDir, options.archivePath);
    const resolvedDestinationDir = path.resolve(destinationDir);
    const destinationRealpath = await getExtractionRealpath(
      destinationDir,
      options.archivePath,
      "<destination>",
    );

    for (const entry of entries) {
      if (entry.kind !== "file") {
        continue;
      }

      const normalizedPath = assertSafePackagePath(entry.path);
      const fileData = files[normalizedPath];

      if (!fileData) {
        throw packageError("FILE_LIST_MISMATCH", "ZIP entry was not extracted.", {
          packagePath: options.archivePath,
          entryPath: normalizedPath,
        });
      }

      const outputPath = path.resolve(destinationDir, ...normalizedPath.split("/"));
      assertContainedPath(resolvedDestinationDir, outputPath, normalizedPath);
      await createExtractionDirectory(path.dirname(outputPath), options.archivePath, normalizedPath);
      await writeExtractedFile(outputPath, fileData, options.archivePath, normalizedPath);

      const outputRealpath = await getExtractionRealpath(
        outputPath,
        options.archivePath,
        normalizedPath,
      );
      assertContainedPath(destinationRealpath, outputRealpath, normalizedPath);
    }
  }
}

function unzipSingleFile(data: Uint8Array, path: string): Record<string, Uint8Array> {
  try {
    return unzipSync(data, {
      filter: (file) => normalizePackagePath(file.name) === path,
    });
  } catch (error) {
    throw mapFflateError(error);
  }
}

async function assertPackageFileSize(
  archivePath: string,
  limits: TooldeckPackageLimits,
): Promise<void> {
  let archiveStat: Awaited<ReturnType<typeof stat>>;

  try {
    archiveStat = await stat(archivePath);
  } catch (error) {
    throw packageError("PACKAGE_READ_FAILED", "Tooldeck package file could not be inspected.", {
      packagePath: archivePath,
      reason: formatUnknownError(error),
    });
  }

  if (archiveStat.size > limits.maxPackageSizeBytes) {
    throw packageError("PACKAGE_TOO_LARGE", "Tooldeck package file is too large.", {
      packagePath: archivePath,
      reason: `${archiveStat.size} > ${limits.maxPackageSizeBytes}`,
    });
  }
}

async function readPackageFile(archivePath: string): Promise<Uint8Array> {
  try {
    return await readFile(archivePath);
  } catch (error) {
    throw packageError("PACKAGE_READ_FAILED", "Tooldeck package could not be read.", {
      packagePath: archivePath,
      reason: formatUnknownError(error),
    });
  }
}

async function writePackageFile(archivePath: string, data: Uint8Array): Promise<void> {
  try {
    await mkdir(path.dirname(archivePath), { recursive: true });
    await writeFile(archivePath, data);
  } catch (error) {
    throw packageError("PACKAGE_WRITE_FAILED", "Tooldeck package could not be written.", {
      packagePath: archivePath,
      reason: formatUnknownError(error),
    });
  }
}

async function createExtractionDirectory(
  directoryPath: string,
  archivePath: string,
  entryPath?: string,
): Promise<void> {
  try {
    await mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw packageError("PACKAGE_EXTRACT_FAILED", "Package extraction directory could not be created.", {
      packagePath: archivePath,
      entryPath,
      reason: formatUnknownError(error),
    });
  }
}

async function writeExtractedFile(
  outputPath: string,
  data: Uint8Array,
  archivePath: string,
  entryPath: string,
): Promise<void> {
  try {
    await writeFile(outputPath, data);
  } catch (error) {
    throw packageError("PACKAGE_EXTRACT_FAILED", "Package entry could not be extracted.", {
      packagePath: archivePath,
      entryPath,
      reason: formatUnknownError(error),
    });
  }
}

async function getExtractionRealpath(
  targetPath: string,
  archivePath: string,
  entryPath: string,
): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    throw packageError("PACKAGE_EXTRACT_FAILED", "Extracted path could not be resolved.", {
      packagePath: archivePath,
      entryPath,
      reason: formatUnknownError(error),
    });
  }
}

function validateEntries(entries: CentralDirectoryEntry[], limits: TooldeckPackageLimits): void {
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
    throw packageError("UNCOMPRESSED_SIZE_TOO_LARGE", "Tooldeck package is too large after unzip.", {
      reason: `${uncompressedSizeBytes} > ${limits.maxUncompressedSizeBytes}`,
    });
  }
}

function parseCentralDirectory(data: Uint8Array): CentralDirectoryEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);

  if (eocdOffset < 0) {
    throw packageError("INVALID_ZIP", "ZIP end of central directory was not found.");
  }

  if (hasZip64Locator(view, eocdOffset)) {
    throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    entryCount === ZIP64_SENTINEL_16 ||
    centralDirectorySize === ZIP64_SENTINEL_32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_32
  ) {
    throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.");
  }

  const entries: CentralDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw packageError("INVALID_ZIP", "Invalid ZIP central directory entry.");
    }

    const generalPurposeFlag = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const fileCommentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const fileNameOffset = offset + 46;
    const fileNameBytes = data.subarray(fileNameOffset, fileNameOffset + fileNameLength);
    const entryPath = normalizePackagePath(strFromU8(fileNameBytes));

    if (compressedSize === ZIP64_SENTINEL_32 || uncompressedSize === ZIP64_SENTINEL_32) {
      throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.", {
        entryPath,
      });
    }

    entries.push({
      path: entryPath,
      kind: classifyEntry(entryPath, externalAttributes),
      compression,
      encrypted: (generalPurposeFlag & 0x1) === 0x1,
      compressedSizeBytes: compressedSize,
      uncompressedSizeBytes: uncompressedSize,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - (MAX_EOCD_COMMENT_BYTES + 22));

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

function hasZip64Locator(view: DataView, eocdOffset: number): boolean {
  const locatorOffset = eocdOffset - 20;

  return locatorOffset >= 0 && view.getUint32(locatorOffset, true) === ZIP64_EOCD_LOCATOR_SIGNATURE;
}

function classifyEntry(entryPath: string, externalAttributes: number): ZipEntryKind {
  if (entryPath.endsWith("/")) {
    return "directory";
  }

  const unixMode = externalAttributes >>> 16;
  const unixType = unixMode & 0o170000;

  if (unixType === 0o040000) {
    return "directory";
  }

  if (unixType === 0o120000) {
    return "symlink";
  }

  if (unixType !== 0 && unixType !== 0o100000) {
    return "special";
  }

  if ((externalAttributes & 0x10) === 0x10) {
    return "directory";
  }

  return "file";
}

function assertContainedPath(root: string, target: string, entryPath: string): void {
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw packageError("EXTRACTION_ESCAPE", "Package extraction escaped the destination directory.", {
      entryPath,
      reason: target,
    });
  }
}

function mapFflateError(error: unknown): never {
  if (isFlateError(error) && error.code === 14) {
    throw packageError("UNSUPPORTED_ZIP_ENTRY", "Unsupported ZIP compression method.", {
      reason: error.message,
    });
  }

  throw packageError("INVALID_ZIP", "ZIP could not be read.", {
    reason: formatUnknownError(error),
  });
}

function isFlateError(error: unknown): error is Error & { code: number } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === "number";
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function textToBytes(text: string): Uint8Array {
  return strToU8(text);
}

export function bytesToText(data: Uint8Array): string {
  return strFromU8(data);
}
