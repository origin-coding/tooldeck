import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPluginProject,
  checkPluginProject,
  distPluginProject,
  generatePluginCommandTypesFile,
  inspectPluginProject,
  packPluginProject,
} from "../src";
import { createManifest, createPluginProject } from "./plugin-project-fixtures";

describe("authoring Schema workflow gates", () => {
  it("rejects unsupported references before generate, build, inspect, pack, or dist operations", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: { value: { $ref: "#/definitions/value" } },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    const generatedPath = path.join(projectDir, "src", "generated", "commands.ts");
    const packagePath = path.join(projectDir, "invalid.tdplugin");
    process.chdir(projectDir);

    await expect(generatePluginCommandTypesFile()).rejects.toThrow(
      "unsupported inputSchema keyword: $ref",
    );

    const check = await checkPluginProject();
    expect(check.ok).toBe(false);
    expect(
      check.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_SCHEMA_UNSUPPORTED_KEYWORD" &&
          diagnostic.fieldPath === "contributes.commands[0].inputSchema.properties.value.$ref" &&
          diagnostic.suggestion?.startsWith("Remove $ref"),
      ),
    ).toBe(true);

    await expect(buildPluginProject({ bundler: "vite" })).rejects.toMatchObject({
      stage: "generate",
    });

    const inspection = await inspectPluginProject();
    expect(inspection.plugin).toBeUndefined();
    expect(
      inspection.diagnostics.some(
        (diagnostic) => diagnostic.code === "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
      ),
    ).toBe(true);

    await expect(packPluginProject({ outputPath: packagePath })).rejects.toThrow(
      "unsupported inputSchema keyword: $ref",
    );
    await expect(distPluginProject({ outputPath: packagePath })).rejects.toThrow(
      "unsupported inputSchema keyword: $ref",
    );

    expect(existsSync(generatedPath)).toBe(false);
    expect(existsSync(path.join(projectDir, "dist"))).toBe(false);
    expect(existsSync(packagePath)).toBe(false);
  });

  it.each([
    [
      "input",
      "INPUT_SCHEMA_COMPILE",
      "contributes.commands[0].inputSchema.properties.value.pattern",
    ],
    [
      "output",
      "OUTPUT_SCHEMA_COMPILE",
      "contributes.commands[0].outputSchema.properties.value.pattern",
    ],
  ] as const)("rejects an invalid %s pattern at its Schema path", async (role, code, fieldPath) => {
    const manifest = createManifest();
    const schema = {
      type: "object",
      properties: { value: { type: "string", pattern: "[" } },
    };

    if (role === "input") {
      manifest.contributes!.commands![0]!.inputSchema = schema as never;
    } else {
      manifest.contributes!.commands![0]!.outputSchema = schema as never;
    }

    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();
    const diagnostic = result.diagnostics.find(
      (item) => item.code === code && item.fieldPath === fieldPath,
    );

    expect(result.ok).toBe(false);
    expect(diagnostic).toMatchObject({
      severity: "error",
      path: path.join(projectDir, "manifest.json"),
    });
    expect(diagnostic?.suggestion).toContain("valid regular expression");
  });

  it("rejects unsupported output formats through the shared output profile", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.outputSchema = {
      type: "object",
      properties: { createdAt: { type: "string", format: "date-time" } },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "OUTPUT_SCHEMA" &&
          diagnostic.fieldPath ===
            "contributes.commands[0].outputSchema.properties.createdAt.format",
      ),
    ).toBe(true);
  });

  it("accepts boolean Schemas at supported nested input and output positions", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: { enabled: true, internal: false },
    };
    manifest.contributes!.commands![0]!.outputSchema = {
      type: "object",
      properties: { blocks: true, internal: false },
    };
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  });
});
