import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
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
    const diagnostic = result.diagnostics.find((item) => item.code === "GENERATED_STALE");

    expect(result.ok).toBe(false);
    expect(diagnostic).toEqual({
      severity: "error",
      code: "GENERATED_STALE",
      message: "Generated command types are out of sync. Run tooldeck-plugin generate.",
      path: path.join(projectDir, "src", "generated", "commands.ts"),
      suggestion: "Run tooldeck-plugin generate and commit the updated generated command types.",
    });
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

  it("preserves an explicit manifest path in schema diagnostics", async () => {
    const projectDir = await createPluginProject({
      manifest: { ...createManifest(), runtime: { kind: "node" } } as never,
    });
    const manifestPath = path.join(projectDir, "plugin.manifest.json");
    await rename(path.join(projectDir, "manifest.json"), manifestPath);
    process.chdir(projectDir);

    const result = await checkPluginProject({ manifestPath });
    const diagnostic = result.diagnostics.find(
      (item) => item.code === "MANIFEST_SCHEMA" && item.fieldPath === "runtime.entry",
    );

    expect(result.manifestPath).toBe(manifestPath);
    expect(diagnostic).toMatchObject({
      path: manifestPath,
      fieldPath: "runtime.entry",
      message: "runtime.entry is required.",
      suggestion: 'Add "runtime.entry": "./dist/index.js".',
    });
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

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_FIELD_X_UI" &&
          diagnostic.message.includes("rows") &&
          diagnostic.fieldPath ===
            "contributes.commands[0].inputSchema.properties.text.x-ui.rows" &&
          diagnostic.suggestion?.includes("use an input control"),
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
    const diagnostic = result.diagnostics.find(
      (item) =>
        item.code === "SCHEMA_X_I18N" &&
        item.fieldPath ===
          "contributes.commands[0].inputSchema.properties.mode.x-i18n.enumLabels.pretty",
    );

    expect(result.ok).toBe(false);
    expect(diagnostic).toEqual({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message:
        "Command at index 0 $.properties.mode.x-i18n.enumLabels.pretty must be a locale key string.",
      path: path.join(projectDir, "manifest.json"),
      fieldPath: "contributes.commands[0].inputSchema.properties.mode.x-i18n.enumLabels.pretty",
      suggestion: 'Change the enum label for "pretty" to a locale key string.',
    });
  });

  it("reports missing schema locale keys with locale file context", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: {
        text: {
          type: "string",
          "x-i18n": { title: "schema.text.title" },
        },
      },
    };
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();
    const diagnostic = result.diagnostics.find(
      (item) => item.code === "LOCALE_KEY_MISSING" && item.fieldPath === "schema.text.title",
    );

    expect(result.ok).toBe(false);
    expect(diagnostic).toEqual({
      severity: "error",
      code: "LOCALE_KEY_MISSING",
      message: "Locale en does not define key: schema.text.title",
      path: path.join(projectDir, "locales", "en.json"),
      fieldPath: "schema.text.title",
      suggestion: 'Add "schema.text.title" to ./locales/en.json with a translated string value.',
    });
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
    const diagnostic = result.diagnostics.find((item) => item.code === "INPUT_FIELD_X_UI_CONTROL");

    expect(diagnostic).toEqual({
      severity: "error",
      code: "INPUT_FIELD_X_UI_CONTROL",
      message: "x-ui.control checkbox is incompatible with the schema for count.",
      path: path.join(projectDir, "manifest.json"),
      fieldPath: "contributes.commands[0].inputSchema.properties.count.x-ui.control",
      suggestion: "Use a control compatible with the field type and enum shape.",
    });
  });
});
