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

  it.each(outputFixtures.valid)(
    "reads packages using supported protocol Schema fixtures: $name",
    async ({ schema: outputSchema }) => {
      const tempDir = createTempDir();
      const packagePath = path.join(tempDir, "schema-profile.tdplugin");
      const manifest = createManifest() as {
        contributes: { commands: Array<Record<string, unknown>> };
      };
      manifest.contributes.commands[0]!.inputSchema = inputFixtures.valid[0]!.schema;
      manifest.contributes.commands[0]!.outputSchema = outputSchema;

      await writeTooldeckPackage(packagePath, {
        files: {
          "manifest.json": JSON.stringify(manifest),
          "tooldeck-package.json": JSON.stringify(
            createTooldeckPackageManifest({ files: ["dist/index.js"] }),
          ),
          "dist/index.js": "export default { activate() {} };\n",
        },
      });

      await expect(readTooldeckPackage({ packagePath })).resolves.toMatchObject({
        pluginManifest: {
          contributes: {
            commands: [
              {
                inputSchema: inputFixtures.valid[0]!.schema,
                outputSchema,
              },
            ],
          },
        },
      });
    },
  );
});
