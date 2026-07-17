import { strFromU8 } from "fflate";

import { packageError } from "./errors.js";
import { normalizePackagePath } from "./paths.js";
import type { ZipEntryKind, ZipEntryMetadata } from "./zip-adapter.js";

export interface CentralDirectoryEntry extends ZipEntryMetadata {
  compression: number;
  encrypted: boolean;
}

// ZIP signatures and sentinel values are defined by the PKWARE APPNOTE spec.
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_FIXED_SIZE = 22;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const MAX_EOCD_COMMENT_BYTES = 0xffff;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

export function parseCentralDirectory(data: Uint8Array): CentralDirectoryEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);

  if (eocdOffset < 0) {
    throw packageError("INVALID_ZIP", "ZIP end of central directory was not found.");
  }

  if (hasZip64Locator(view, eocdOffset)) {
    throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.");
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw packageError("UNSUPPORTED_ZIP_ENTRY", "Multi-disk ZIP packages are not supported.");
  }

  if (
    entryCount === ZIP64_SENTINEL_16 ||
    centralDirectorySize === ZIP64_SENTINEL_32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_32
  ) {
    throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.");
  }

  const endOffset = centralDirectoryOffset + centralDirectorySize;

  if (endOffset !== eocdOffset || centralDirectoryOffset > endOffset) {
    throw packageError("INVALID_ZIP", "ZIP central directory range is invalid.");
  }

  const entries: CentralDirectoryEntry[] = [];
  const entryPaths = new Set<string>();
  let offset = centralDirectoryOffset;

  while (offset < endOffset) {
    assertAvailableRange(
      view,
      offset,
      CENTRAL_DIRECTORY_HEADER_SIZE,
      "ZIP central directory entry",
    );

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
    const entrySize =
      CENTRAL_DIRECTORY_HEADER_SIZE + fileNameLength + extraFieldLength + fileCommentLength;

    assertAvailableRange(view, offset, entrySize, "ZIP central directory entry data");

    if (offset + entrySize > endOffset) {
      throw packageError("INVALID_ZIP", "ZIP central directory entry exceeds its declared range.");
    }

    const fileNameOffset = offset + CENTRAL_DIRECTORY_HEADER_SIZE;
    const fileNameBytes = data.subarray(fileNameOffset, fileNameOffset + fileNameLength);
    const rawEntryPath = strFromU8(fileNameBytes);
    const entryPath = normalizePackagePath(rawEntryPath);

    if (entryPaths.has(entryPath)) {
      throw packageError(
        "DUPLICATE_FILE_LIST_ENTRY",
        "ZIP entries must not contain duplicate paths.",
        {
          entryPath,
        },
      );
    }

    entryPaths.add(entryPath);

    if (compressedSize === ZIP64_SENTINEL_32 || uncompressedSize === ZIP64_SENTINEL_32) {
      throw packageError("UNSUPPORTED_ZIP64", "ZIP64 packages are not supported.", {
        entryPath,
      });
    }

    entries.push({
      path: entryPath,
      kind: classifyEntry(rawEntryPath, externalAttributes),
      compression,
      encrypted: (generalPurposeFlag & 0x1) === 0x1,
      compressedSizeBytes: compressedSize,
      uncompressedSizeBytes: uncompressedSize,
    });

    offset += entrySize;
  }

  if (offset !== endOffset || entries.length !== entryCount) {
    throw packageError("INVALID_ZIP", "ZIP central directory entry count does not match EOCD.");
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - (MAX_EOCD_COMMENT_BYTES + EOCD_FIXED_SIZE));

  for (let offset = view.byteLength - EOCD_FIXED_SIZE; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) {
      continue;
    }

    const commentLength = view.getUint16(offset + 20, true);

    if (offset + EOCD_FIXED_SIZE + commentLength === view.byteLength) {
      return offset;
    }
  }

  return -1;
}

function hasZip64Locator(view: DataView, eocdOffset: number): boolean {
  const locatorOffset = eocdOffset - 20;

  return locatorOffset >= 0 && view.getUint32(locatorOffset, true) === ZIP64_EOCD_LOCATOR_SIGNATURE;
}

function classifyEntry(rawEntryPath: string, externalAttributes: number): ZipEntryKind {
  if (rawEntryPath.replaceAll("\\", "/").endsWith("/")) {
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

function assertAvailableRange(
  view: DataView,
  offset: number,
  length: number,
  description: string,
): void {
  if (offset < 0 || length < 0 || offset > view.byteLength - length) {
    throw packageError("INVALID_ZIP", `${description} is truncated.`);
  }
}
