import path from "node:path";

import { describe, expect, it } from "vitest";

import inputFixtures from "../../protocol/schema/fixtures/command-input-v1.fixtures.json";
import outputFixtures from "../../protocol/schema/fixtures/command-output-v1.fixtures.json";
import {
  createTooldeckPackageManifest,
  normalizePackagePath,
  packTooldeckPlugin,
  readTooldeckPackage,
} from "../src";
import {
  createPackageProject,
  createTempDir,
  encode,
  writeTooldeckPackage,
  createManifest,
} from "./package-test-fixtures";

describe("Tooldeck plugin package creation", () => {
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

  it.each(inputFixtures.valid)(
    "reads packages using supported input Schema fixture: $name",
    async ({ schema: inputSchema }) => {
      await expect(readPackageWithSchemas({ inputSchema })).resolves.toMatchObject({
        pluginManifest: {
          contributes: {
            commands: [{ inputSchema }],
          },
        },
      });
    },
  );

  it.each(outputFixtures.valid)(
    "reads packages using supported output Schema fixture: $name",
    async ({ schema: outputSchema }) => {
      await expect(readPackageWithSchemas({ outputSchema })).resolves.toMatchObject({
        pluginManifest: {
          contributes: {
            commands: [{ outputSchema }],
          },
        },
      });
    },
  );

  it.each(inputFixtures.invalid)(
    "rejects unsupported input Schema fixture during package validation: $name",
    async ({ schema: inputSchema }) => {
      await expect(readPackageWithSchemas({ inputSchema })).rejects.toMatchObject({
        code: "INVALID_PLUGIN_MANIFEST",
        context: {
          manifestPath: "manifest.json",
          fieldPath: expect.stringMatching(/^contributes\.commands\[0]\.inputSchema/),
          reason: expect.any(String),
        },
      });
    },
  );

  it.each(outputFixtures.invalid)(
    "rejects unsupported output Schema fixture during package validation: $name",
    async ({ schema: outputSchema }) => {
      await expect(readPackageWithSchemas({ outputSchema })).rejects.toMatchObject({
        code: "INVALID_PLUGIN_MANIFEST",
        context: {
          manifestPath: "manifest.json",
          fieldPath: expect.stringMatching(/^contributes\.commands\[0]\.outputSchema/),
          reason: expect.any(String),
        },
      });
    },
  );

  it("rejects invalid command Schema patterns during package validation", async () => {
    await expect(
      readPackageWithSchemas({
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", pattern: "[" },
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PLUGIN_MANIFEST",
      context: {
        manifestPath: "manifest.json",
        fieldPath: "contributes.commands[0].inputSchema.properties.text.pattern",
        reason: "pattern",
      },
    });
  });
});

async function readPackageWithSchemas(options: { inputSchema?: unknown; outputSchema?: unknown }) {
  const tempDir = createTempDir();
  const packagePath = path.join(tempDir, "schema-profile.tdplugin");
  const manifest = createManifest() as {
    contributes: { commands: Array<Record<string, unknown>> };
  };
  const command = manifest.contributes.commands[0]!;

  if (options.inputSchema !== undefined) {
    command.inputSchema = options.inputSchema;
  }

  if (options.outputSchema !== undefined) {
    command.outputSchema = options.outputSchema;
  }

  await writeTooldeckPackage(packagePath, {
    files: {
      "manifest.json": JSON.stringify(manifest),
      "tooldeck-package.json": JSON.stringify(
        createTooldeckPackageManifest({ files: ["dist/index.js"] }),
      ),
      "dist/index.js": "export default { activate() {} };\n",
    },
  });

  return readTooldeckPackage({ packagePath });
}
