import type { TooldeckPackageLimits } from "./types.js";

export type ZipEntryKind = "file" | "directory" | "symlink" | "special";

export interface ZipEntryMetadata {
  path: string;
  kind: ZipEntryKind;
  compressedSizeBytes?: number;
  uncompressedSizeBytes?: number;
}

export interface ZipWriteEntry {
  path: string;
  data: Uint8Array;
}

export interface ZipReadArchive {
  entries: ZipEntryMetadata[];
  readFile(path: string): Promise<Uint8Array>;
}

export interface ZipAdapter {
  readArchive(path: string, limits: TooldeckPackageLimits): Promise<ZipReadArchive>;
  writeArchive(path: string, entries: ZipWriteEntry[]): Promise<void>;
  extractArchive(options: {
    archivePath: string;
    destinationDir: string;
    limits: TooldeckPackageLimits;
  }): Promise<void>;
}
