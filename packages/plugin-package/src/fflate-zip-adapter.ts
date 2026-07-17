import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

import { packageError } from "./errors.js";
import { assertSafePackagePath, normalizePackagePath } from "./paths.js";
import type { TooldeckPackageLimits } from "./types.js";
import type { ZipAdapter, ZipReadArchive, ZipWriteEntry } from "./zip-adapter.js";
import { parseCentralDirectory } from "./zip-central-directory.js";
import { validateZipEntries } from "./zip-entry-policy.js";

export class FflateZipAdapter implements ZipAdapter {
  async readArchive(archivePath: string, limits: TooldeckPackageLimits): Promise<ZipReadArchive> {
    await assertPackageFileSize(archivePath, limits);
    const data = await readPackageFile(archivePath);
    const entries = parseCentralDirectory(data);

    validateZipEntries(entries, limits);

    return {
      entries,
      readFile: async (entryPath) => {
        const normalizedPath = assertSafePackagePath(entryPath);
        const file = unzipSingleFile(data, normalizedPath);

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
    validateZipEntries(entries, options.limits);
    const files = unzipArchive(data, options.archivePath);
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
      const fileData = files.get(normalizedPath);

      if (!fileData) {
        throw packageError("FILE_LIST_MISMATCH", "ZIP entry was not extracted.", {
          packagePath: options.archivePath,
          entryPath: normalizedPath,
        });
      }

      const outputPath = path.resolve(destinationDir, ...normalizedPath.split("/"));
      assertContainedPath(resolvedDestinationDir, outputPath, normalizedPath);
      await createExtractionDirectory(
        path.dirname(outputPath),
        options.archivePath,
        normalizedPath,
      );
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

function unzipSingleFile(data: Uint8Array, entryPath: string): Uint8Array | undefined {
  try {
    const files = unzipSync(data, {
      filter: (file) => normalizePackagePath(file.name) === entryPath,
    });

    return Object.entries(files).find(([path]) => normalizePackagePath(path) === entryPath)?.[1];
  } catch (error) {
    throw mapFflateError(error);
  }
}

function unzipArchive(data: Uint8Array, archivePath: string): Map<string, Uint8Array> {
  try {
    return new Map(
      Object.entries(unzipSync(data)).map(([entryPath, fileData]) => [
        normalizePackagePath(entryPath),
        fileData,
      ]),
    );
  } catch (error) {
    throw packageError("PACKAGE_EXTRACT_FAILED", "Tooldeck package could not be extracted.", {
      packagePath: archivePath,
      reason: formatUnknownError(error),
    });
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
    throw packageError(
      "PACKAGE_EXTRACT_FAILED",
      "Package extraction directory could not be created.",
      {
        packagePath: archivePath,
        entryPath,
        reason: formatUnknownError(error),
      },
    );
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

function assertContainedPath(root: string, target: string, entryPath: string): void {
  const relative = path.relative(root, target);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw packageError(
      "EXTRACTION_ESCAPE",
      "Package extraction escaped the destination directory.",
      {
        entryPath,
        reason: target,
      },
    );
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
