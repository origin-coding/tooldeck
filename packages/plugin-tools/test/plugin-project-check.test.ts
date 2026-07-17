import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkPluginProject,
  formatPluginCheckResult,
  generatePluginCommandTypesFile,
} from "../src";
import { createManifest, createPluginProject } from "./plugin-project-fixtures";

describe("checkPluginProject", () => {
  it("passes for a generated plugin project", async () => {
    const projectDir = await createPluginProject();
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("fails when generated command types are stale", async () => {
    const projectDir = await createPluginProject();
    process.chdir(projectDir);
    await mkdir(path.join(projectDir, "src", "generated"), { recursive: true });
    await writeFile(path.join(projectDir, "src", "generated", "commands.ts"), "stale", "utf8");

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "GENERATED_STALE")).toBe(
      true,
    );
  });

  it("checks built ESM output without activating the plugin", async () => {
    const projectDir = await createPluginProject();
    const activationMarker = path.join(projectDir, "activated.txt").replaceAll("\\", "\\\\");
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(
      path.join(projectDir, "dist", "index.js"),
      `import { writeFileSync } from "node:fs";\nexport default { activate() { writeFileSync("${activationMarker}", "activated"); } };\n`,
      "utf8",
    );

    const result = await checkPluginProject({ built: true });

    expect(result.ok).toBe(true);
    expect(existsSync(path.join(projectDir, "activated.txt"))).toBe(false);
  });

  it("reports built output without a Tooldeck default export", async () => {
    const projectDir = await createPluginProject();
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(path.join(projectDir, "dist", "index.js"), "export const value = 1;\n", "utf8");

    const result = await checkPluginProject({ built: true });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "BUILT_PLUGIN_DEFAULT_EXPORT"),
    ).toBe(true);
  });

  it("requires @tooldeck/vite-plugin for Vite plugin projects", async () => {
    const projectDir = await createPluginProject({ includeVitePlugin: false });
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "PACKAGE_DEPENDENCY_MISSING" &&
          diagnostic.message.includes("@tooldeck/vite-plugin"),
      ),
    ).toBe(true);
  });

  it("rejects command input schemas outside the supported subset", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: { text: { type: "string" } },
      oneOf: [{ required: ["text"] }],
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_SCHEMA_UNSUPPORTED_KEYWORD" &&
          diagnostic.message.includes("oneOf") &&
          diagnostic.fieldPath === "contributes.commands[0].inputSchema.oneOf" &&
          diagnostic.suggestion?.includes("Remove oneOf"),
      ),
    ).toBe(true);
  });

  it("normalizes manifest schema errors into actionable diagnostics", async () => {
    const projectDir = await createPluginProject({
      manifest: { ...createManifest(), runtime: { kind: "node" } } as never,
    });
    process.chdir(projectDir);

    const result = await checkPluginProject();
    const diagnostic = result.diagnostics.find(
      (item) => item.code === "MANIFEST_SCHEMA" && item.fieldPath === "runtime.entry",
    );

    expect(diagnostic).toMatchObject({
      severity: "error",
      path: path.join(projectDir, "manifest.json"),
      message: "runtime.entry is required.",
      suggestion: 'Add "runtime.entry": "./dist/index.js".',
    });
    expect(formatPluginCheckResult(result)).toContain("Field: runtime.entry");
    expect(formatPluginCheckResult(result)).toContain(
      'Fix: Add "runtime.entry": "./dist/index.js".',
    );
  });

  it("rejects unsupported field x-ui properties for the selected control", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      required: ["text"],
      additionalProperties: false,
      properties: { text: { type: "string", "x-ui": { control: "text", rows: 10 } } },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_FIELD_X_UI" &&
          diagnostic.message.includes("rows") &&
          diagnostic.message.includes("text control"),
      ),
    ).toBe(true);
  });

  it("rejects malformed x-i18n enum labels", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["compact", "pretty"],
          "x-i18n": {
            enumLabels: {
              compact: "schema.mode.compact",
              pretty: { key: "schema.mode.pretty", default: "Pretty" },
            },
          },
        },
      },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SCHEMA_X_I18N" && diagnostic.message.includes("enumLabels.pretty"),
      ),
    ).toBe(true);
  });

  it("rejects x-ui nested below a direct input property", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: { nested: { type: "string", "x-ui": { control: "text" } } },
        },
      },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.diagnostics.some((item) => item.code === "INPUT_SCHEMA_NESTED_X_UI")).toBe(true);
  });

  it("rejects x-ui nested in an output schema", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.outputSchema = {
      type: "object",
      properties: { value: { type: "string", "x-ui": { control: "text" } } },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.diagnostics.some((item) => item.code === "OUTPUT_SCHEMA_X_UI")).toBe(true);
  });

  it("rejects a control that is incompatible with its field schema", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: { count: { type: "number", "x-ui": { control: "checkbox" } } },
    } as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.diagnostics.some((item) => item.code === "INPUT_FIELD_X_UI_CONTROL")).toBe(true);
  });
});
