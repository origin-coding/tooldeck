import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTooldeckPackageManifest, readTooldeckPackage, TooldeckPackageError } from "../src";
import {
  createReadablePackage,
  createTempDir,
  encode,
  injectZip64Locator,
  patchFirstCentralDirectoryEntryFlag,
  writeRawZip,
  createManifest,
} from "./package-test-fixtures";

describe("Tooldeck plugin ZIP validation", () => {
  it.each([
    ["random non-ZIP bytes", new Uint8Array([0xde, 0xad, 0xbe, 0xef])],
    ["a truncated ZIP", undefined],
  ])("rejects damaged packages containing %s", async (_description, packageBytes) => {
    const readablePackagePath = await createReadablePackage();
    const packagePath = path.join(path.dirname(readablePackagePath), "damaged.tdplugin");
    const readablePackageBytes = await readFile(readablePackagePath);

    await writeFile(
      packagePath,
      packageBytes ?? readablePackageBytes.subarray(0, Math.floor(readablePackageBytes.length / 2)),
    );

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "INVALID_ZIP",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects a package whose compressed manifest data is corrupted", async () => {
    const readablePackagePath = await createReadablePackage();
    const packagePath = path.join(path.dirname(readablePackagePath), "corrupted-data.tdplugin");
    const packageBytes = new Uint8Array(await readFile(readablePackagePath));
    const manifestName = encode("manifest.json");
    const manifestNameOffset = findBytes(packageBytes, manifestName);

    expect(manifestNameOffset).toBeGreaterThanOrEqual(30);

    const localHeaderOffset = manifestNameOffset - 30;
    const localHeader = new DataView(
      packageBytes.buffer,
      packageBytes.byteOffset,
      packageBytes.byteLength,
    );
    const fileNameLength = localHeader.getUint16(localHeaderOffset + 26, true);
    const extraFieldLength = localHeader.getUint16(localHeaderOffset + 28, true);
    const compressedDataOffset = localHeaderOffset + 30 + fileNameLength + extraFieldLength;

    packageBytes[compressedDataOffset] = packageBytes[compressedDataOffset]! ^ 0xff;
    await writeFile(packagePath, packageBytes);

    await expect(readTooldeckPackage({ packagePath })).rejects.toBeInstanceOf(TooldeckPackageError);
  });

  it.each([
    ["absolute paths", "/evil.txt", "INVALID_PACKAGE_PATH"],
    ["path traversal", "../evil.txt", "INVALID_PACKAGE_PATH"],
    ["node_modules", "node_modules/pkg/index.js", "NODE_MODULES_NOT_ALLOWED"],
  ] as const)("rejects unsafe ZIP entry paths: %s", async (_name, entryPath, code) => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "unsafe.tdplugin");

    await writeRawZip(packagePath, {
      [entryPath]: "bad",
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code,
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects ZIP entries that normalize to the same package path", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "normalized-duplicates.tdplugin");

    await writeRawZip(packagePath, {
      "dist/index.js": "first",
      "dist\\index.js": "second",
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "DUPLICATE_FILE_LIST_ENTRY",
      context: {
        entryPath: "dist/index.js",
      },
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects data appended after the ZIP end record", async () => {
    const packagePath = await createReadablePackage();
    const malformedPackagePath = path.join(path.dirname(packagePath), "trailing-data.tdplugin");
    const packageBytes = await readFile(packagePath);
    const malformedBytes = new Uint8Array(packageBytes.length + 1);

    malformedBytes.set(packageBytes);
    malformedBytes[malformedBytes.length - 1] = 1;
    await writeFile(malformedPackagePath, malformedBytes);

    await expect(readTooldeckPackage({ packagePath: malformedPackagePath })).rejects.toMatchObject({
      code: "INVALID_ZIP",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects packages over the package file size limit", async () => {
    const packagePath = await createReadablePackage();

    await expect(
      readTooldeckPackage({
        packagePath,
        limits: {
          maxPackageSizeBytes: 1,
        },
      }),
    ).rejects.toMatchObject({
      code: "PACKAGE_TOO_LARGE",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects packages over the regular file count limit", async () => {
    const packagePath = await createReadablePackage();

    await expect(
      readTooldeckPackage({
        packagePath,
        limits: {
          maxRegularFileCount: 2,
        },
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_FILES",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects packages over the uncompressed size limit", async () => {
    const packagePath = await createReadablePackage();

    await expect(
      readTooldeckPackage({
        packagePath,
        limits: {
          maxUncompressedSizeBytes: 1,
        },
      }),
    ).rejects.toMatchObject({
      code: "UNCOMPRESSED_SIZE_TOO_LARGE",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects encrypted ZIP entries", async () => {
    const packagePath = await createReadablePackage();
    const encryptedPackagePath = path.join(path.dirname(packagePath), "encrypted.tdplugin");
    const encryptedBytes = patchFirstCentralDirectoryEntryFlag(
      await readFile(packagePath),
      (flag) => flag | 0x1,
    );

    await writeFile(encryptedPackagePath, encryptedBytes);

    await expect(readTooldeckPackage({ packagePath: encryptedPackagePath })).rejects.toMatchObject({
      code: "UNSUPPORTED_ENCRYPTED_ZIP",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects ZIP64 packages", async () => {
    const packagePath = await createReadablePackage();
    const zip64PackagePath = path.join(path.dirname(packagePath), "zip64.tdplugin");

    await writeFile(zip64PackagePath, injectZip64Locator(await readFile(packagePath)));

    await expect(readTooldeckPackage({ packagePath: zip64PackagePath })).rejects.toMatchObject({
      code: "UNSUPPORTED_ZIP64",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects symlink ZIP entries", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "symlink.tdplugin");

    await writeRawZip(packagePath, {
      "manifest.json": JSON.stringify(createManifest()),
      "tooldeck-package.json": JSON.stringify(createTooldeckPackageManifest({ files: ["link"] })),
      link: [encode("dist/index.js"), { os: 3, attrs: 0o120777 << 16 }],
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "UNSUPPORTED_ZIP_ENTRY",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects special ZIP entries", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "special.tdplugin");

    await writeRawZip(packagePath, {
      "manifest.json": JSON.stringify(createManifest()),
      "tooldeck-package.json": JSON.stringify(createTooldeckPackageManifest({ files: ["device"] })),
      device: [encode("device"), { os: 3, attrs: 0o020666 << 16 }],
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "UNSUPPORTED_ZIP_ENTRY",
    } satisfies Partial<TooldeckPackageError>);
  });
});

function findBytes(data: Uint8Array, target: Uint8Array): number {
  for (let offset = 0; offset <= data.length - target.length; offset += 1) {
    if (target.every((value, index) => data[offset + index] === value)) {
      return offset;
    }
  }

  return -1;
}
