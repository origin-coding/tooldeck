import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import {
  computePackageDigest,
  createTooldeckPackageManifest,
  FflateZipAdapter,
  normalizePackagePath,
  packTooldeckPlugin,
  readTooldeckPackage,
  TooldeckPackageError,
  unpackTooldeckPackage,
} from "../src";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Tooldeck plugin packages", () => {
  it("normalizes package paths before matching entries", () => {
    expect(normalizePackagePath(".\\dist\\index.js")).toBe("dist/index.js");
    expect(normalizePackagePath("./locales//en.json")).toBe("locales/en.json");
  });

  it("packs and reads a built plugin project", async () => {
    const projectDir = await createPackageProject();
    const packagePath = path.join(projectDir, "release.tdplugin");

    const packResult = await packTooldeckPlugin({
      projectDir,
      outputPath: packagePath,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const summary = await readTooldeckPackage({ packagePath });

    expect(packResult.packagePath).toBe(packagePath);
    expect(summary.pluginManifest.id).toBe("dev.tooldeck.package-test");
    expect(summary.packageManifest).toMatchObject({
      formatVersion: "1.0",
      manifestPath: "manifest.json",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect(summary.files).toEqual([
      "assets/icon.txt",
      "dist/index.js",
      "locales/en.json",
      "manifest.json",
      "tooldeck-package.json",
    ]);
    expect(summary.packageDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches manifest runtime entries after package path normalization", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "runtime-entry.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest({ runtimeEntry: ".\\dist\\index.js" })),
        "tooldeck-package.json": JSON.stringify(
          createTooldeckPackageManifest({ files: ["dist/index.js"] }),
        ),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).resolves.toMatchObject({
      pluginManifest: {
        runtime: {
          entry: ".\\dist\\index.js",
        },
      },
    });
  });

  it("reads packages for non-node runtime kinds without runtime-specific validation", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "runtime-agnostic.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(
          createManifest({
            runtimeKind: "wasm",
            runtimeEntry: "./module.wasm",
          }),
        ),
        "tooldeck-package.json": JSON.stringify(
          createTooldeckPackageManifest({ files: ["module.wasm"] }),
        ),
        "module.wasm": encode("wasm bytes"),
      },
    });

    await expect(readTooldeckPackage({ packagePath })).resolves.toMatchObject({
      pluginManifest: {
        runtime: {
          kind: "wasm",
          entry: "./module.wasm",
        },
      },
    });
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

  it("rejects packages missing root manifest.json", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "missing-manifest.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "tooldeck-package.json": JSON.stringify(createTooldeckPackageManifest({ files: [] })),
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "MISSING_PLUGIN_MANIFEST",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects packages missing root tooldeck-package.json", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "missing-package-manifest.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest()),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "MISSING_PACKAGE_MANIFEST",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects plugin manifests that do not match the protocol schema", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "invalid-manifest.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest({ commandId: "Invalid Command" })),
        "tooldeck-package.json": JSON.stringify(
          createTooldeckPackageManifest({ files: ["dist/index.js"] }),
        ),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "INVALID_PLUGIN_MANIFEST",
      context: {
        fieldPath: "contributes.commands[0].id",
      },
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects packages missing the manifest runtime entry", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "missing-runtime.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest()),
        "tooldeck-package.json": JSON.stringify(createTooldeckPackageManifest({ files: [] })),
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "MISSING_RUNTIME_ENTRY",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects unsorted tooldeck-package.json file lists", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "unsorted.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest()),
        "tooldeck-package.json": JSON.stringify({
          formatVersion: "1.0",
          manifestPath: "manifest.json",
          createdAt: "2026-07-01T00:00:00.000Z",
          files: ["tooldeck-package.json", "manifest.json", "dist/index.js"],
        }),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "UNSORTED_FILE_LIST",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects duplicate tooldeck-package.json file list entries", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "duplicates.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest()),
        "tooldeck-package.json": JSON.stringify({
          formatVersion: "1.0",
          manifestPath: "manifest.json",
          createdAt: "2026-07-01T00:00:00.000Z",
          files: ["dist/index.js", "dist/index.js", "manifest.json", "tooldeck-package.json"],
        }),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "DUPLICATE_FILE_LIST_ENTRY",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects package manifests that declare missing files", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "declared-missing.tdplugin");

    await writeTooldeckPackage(packagePath, {
      files: {
        "manifest.json": JSON.stringify(createManifest()),
        "tooldeck-package.json": JSON.stringify(
          createTooldeckPackageManifest({ files: ["dist/index.js", "missing.txt"] }),
        ),
        "dist/index.js": "export default { activate() {} };\n",
      },
    });

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "FILE_LIST_MISMATCH",
    } satisfies Partial<TooldeckPackageError>);
  });

  it("rejects ZIP entries not declared by the package file list", async () => {
    const tempDir = createTempDir();
    const packagePath = path.join(tempDir, "bad.tdplugin");
    const adapter = new FflateZipAdapter();
    const packageManifest = createTooldeckPackageManifest({
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      files: ["manifest.json"],
    });

    await adapter.writeArchive(packagePath, [
      {
        path: "manifest.json",
        data: encode(
          JSON.stringify({
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: {
              kind: "node",
              entry: "./dist/index.js",
            },
          }),
        ),
      },
      {
        path: "tooldeck-package.json",
        data: encode(JSON.stringify(packageManifest)),
      },
      {
        path: "dist/index.js",
        data: encode("export default { activate() {} };\n"),
      },
    ]);

    await expect(readTooldeckPackage({ packagePath })).rejects.toMatchObject({
      code: "FILE_LIST_MISMATCH",
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

  it("computes a stable digest for the same package bytes", async () => {
    const packagePath = await createReadablePackage();

    await expect(computePackageDigest(packagePath)).resolves.toBe(
      await computePackageDigest(packagePath),
    );
    await expect(readTooldeckPackage({ packagePath })).resolves.toMatchObject({
      packageDigest: await computePackageDigest(packagePath),
    });
  });

  it("unpacks packages inside the destination directory", async () => {
    const packagePath = await createReadablePackage();
    const destinationDir = path.join(path.dirname(packagePath), "installed");

    await unpackTooldeckPackage({
      packagePath,
      destinationDir,
    });

    await expect(readFile(path.join(destinationDir, "dist", "index.js"), "utf8")).resolves.toBe(
      "export default { activate() {} };\n",
    );
  });
});

async function createPackageProject(): Promise<string> {
  const projectDir = createTempDir();

  await mkdir(path.join(projectDir, "dist"), { recursive: true });
  await mkdir(path.join(projectDir, "locales"), { recursive: true });
  await mkdir(path.join(projectDir, "assets"), { recursive: true });
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: "dev.tooldeck.package-test",
      name: "Package Test",
      version: "0.1.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      defaultLocale: "en",
      locales: {
        en: "./locales/en.json",
      },
      contributes: {
        commands: [
          {
            id: "package.test",
            title: "Package Test",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(path.join(projectDir, "dist", "index.js"), "export default { activate() {} };\n");
  await writeFile(path.join(projectDir, "locales", "en.json"), JSON.stringify({}));
  await writeFile(path.join(projectDir, "assets", "icon.txt"), "icon");

  return projectDir;
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-package-"));

  tempDirs.push(dir);

  return dir;
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function createReadablePackage(): Promise<string> {
  const projectDir = await createPackageProject();
  const packagePath = path.join(projectDir, "readable.tdplugin");

  await packTooldeckPlugin({
    projectDir,
    outputPath: packagePath,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });

  return packagePath;
}

async function writeTooldeckPackage(
  packagePath: string,
  options: {
    files: Record<string, string | Uint8Array>;
  },
): Promise<void> {
  const adapter = new FflateZipAdapter();

  await adapter.writeArchive(
    packagePath,
    Object.entries(options.files).map(([entryPath, data]) => ({
      path: entryPath,
      data: typeof data === "string" ? encode(data) : data,
    })),
  );
}

async function writeRawZip(
  packagePath: string,
  entries: Record<string, string | Uint8Array | [Uint8Array, { os?: number; attrs?: number }]>,
): Promise<void> {
  const zippable = Object.fromEntries(
    Object.entries(entries).map(([entryPath, data]) => [
      entryPath,
      typeof data === "string" ? encode(data) : data,
    ]),
  );

  await writeFile(packagePath, zipSync(zippable));
}

function createManifest(
  options: {
    commandId?: string;
    runtimeEntry?: string;
    runtimeKind?: string;
  } = {},
): object {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.package-test",
    name: "Package Test",
    version: "0.1.0",
    runtime: {
      kind: options.runtimeKind ?? "node",
      entry: options.runtimeEntry ?? "./dist/index.js",
    },
    contributes: {
      commands: [
        {
          id: options.commandId ?? "package.test",
          title: "Package Test",
        },
      ],
    },
  };
}

function patchFirstCentralDirectoryEntryFlag(
  data: Uint8Array,
  patch: (flag: number) => number,
): Uint8Array {
  const patched = new Uint8Array(data);
  const view = new DataView(patched.buffer, patched.byteOffset, patched.byteLength);
  const centralDirectoryOffset = findSignature(view, 0x02014b50);

  if (centralDirectoryOffset < 0) {
    throw new Error("Central directory not found.");
  }

  const flagOffset = centralDirectoryOffset + 8;
  view.setUint16(flagOffset, patch(view.getUint16(flagOffset, true)), true);

  return patched;
}

function injectZip64Locator(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findSignature(view, 0x06054b50);

  if (eocdOffset < 0) {
    throw new Error("EOCD not found.");
  }

  const locator = new Uint8Array(20);
  new DataView(locator.buffer).setUint32(0, 0x07064b50, true);
  const patched = new Uint8Array(data.length + locator.length);

  patched.set(data.subarray(0, eocdOffset));
  patched.set(locator, eocdOffset);
  patched.set(data.subarray(eocdOffset), eocdOffset + locator.length);

  return patched;
}

function findSignature(view: DataView, signature: number): number {
  for (let offset = 0; offset <= view.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === signature) {
      return offset;
    }
  }

  return -1;
}
