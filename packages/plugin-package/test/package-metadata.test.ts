import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createTooldeckPackageManifest,
  FflateZipAdapter,
  readTooldeckPackage,
  TooldeckPackageError,
} from "../src";
import {
  createTempDir,
  encode,
  writeTooldeckPackage,
  createManifest,
} from "./package-test-fixtures";

describe("Tooldeck plugin package metadata", () => {
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
});
