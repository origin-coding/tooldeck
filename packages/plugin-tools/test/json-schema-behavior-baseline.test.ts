import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import inputFixtures from "../../protocol/schema/fixtures/command-input-v1.fixtures.json";
import outputFixtures from "../../protocol/schema/fixtures/command-output-v1.fixtures.json";
import { checkPluginProject, generatePluginCommandTypesFile } from "../src";
import type { PluginProjectDiagnostic } from "../src/project/types";
import { createManifest, createPluginProject } from "./plugin-project-fixtures";

const inputDiagnosticBaseline = {
  "type arrays are unsupported": {
    code: "INPUT_SCHEMA_UNSUPPORTED_TYPE",
    message: "Command at index 0 $.properties.value.type must be a single supported type.",
    fieldPath: "contributes.commands[0].inputSchema.properties.value.type",
    suggestion: "Use a single supported JSON Schema type instead of a type array.",
  },
  "composition branches are unsupported": {
    code: "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
    message: "Command at index 0 $ uses unsupported inputSchema keyword: oneOf",
    fieldPath: "contributes.commands[0].inputSchema.oneOf",
    suggestion:
      "Remove oneOf from the command inputSchema or replace it with a supported JSON Schema keyword.",
  },
  "references are unsupported": {
    code: "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
    message: "Command at index 0 $.properties.value uses unsupported inputSchema keyword: $ref",
    fieldPath: "contributes.commands[0].inputSchema.properties.value.$ref",
    suggestion:
      "Remove $ref from the command inputSchema or replace it with a supported JSON Schema keyword.",
  },
  "tuple items are unsupported": {
    code: "INPUT_SCHEMA_ITEMS",
    message: "Command at index 0 $.properties.values.items must be a schema object.",
    fieldPath: "contributes.commands[0].inputSchema.properties.values.items",
    suggestion: "Change items to a schema object.",
  },
  "nested x-ui is unsupported": {
    code: "INPUT_SCHEMA_NESTED_X_UI",
    message: "Command at index 0 $.properties.options.properties.value must not use x-ui.",
    fieldPath: "contributes.commands[0].inputSchema.properties.options.properties.value.x-ui",
    suggestion: "Move x-ui to the input schema root or one of its direct properties.",
  },
  "undeclared keywords are unsupported": {
    code: "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
    message: "Command at index 0 $ uses unsupported inputSchema keyword: format",
    fieldPath: "contributes.commands[0].inputSchema.format",
    suggestion:
      "Remove format from the command inputSchema or replace it with a supported JSON Schema keyword.",
  },
} as const satisfies Record<
  string,
  Pick<PluginProjectDiagnostic, "code" | "message" | "fieldPath" | "suggestion">
>;

describe("plugin-tools JSON Schema behavior baseline", () => {
  it.each(inputFixtures.valid)("accepts supported input fixture: $name", async ({ schema }) => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = schema as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);
    await writeFile(
      path.join(projectDir, "locales", "en.json"),
      JSON.stringify({
        "plugin.name": "Test Tools",
        "commands.format.title": "Format JSON",
        "schema.example.title": "Example input",
        "schema.example.description": "Exercises the supported command input profile.",
        "schema.example.hello": "Hello",
        "schema.example.world": "World",
        "schema.example.placeholder": "Choose a value",
      }),
      "utf8",
    );
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  });

  it.each(outputFixtures.valid)("accepts supported output fixture: $name", async ({ schema }) => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.outputSchema = schema as never;
    const projectDir = await createPluginProject({ manifest });
    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  });

  it.each(inputFixtures.invalid.filter(({ name }) => name in inputDiagnosticBaseline))(
    "preserves author diagnostics for input fixture: $name",
    async ({ name, schema }) => {
      const manifest = createManifest();
      manifest.contributes!.commands![0]!.inputSchema = schema as never;
      const projectDir = await createPluginProject({ manifest });
      process.chdir(projectDir);

      const result = await checkPluginProject();
      const expected = inputDiagnosticBaseline[name as keyof typeof inputDiagnosticBaseline];
      const diagnostic = result.diagnostics.find(
        (item) => item.code === expected.code && item.fieldPath === expected.fieldPath,
      );

      expect(diagnostic).toEqual({
        severity: "error",
        path: path.join(projectDir, "manifest.json"),
        ...expected,
      });
    },
  );
});
