import { createTooldeckJsonSchemaEngine } from "@tooldeck/json-schema";
import type {
  PluginManifest,
  TooldeckInputJsonSchema,
  TooldeckOutputJsonSchema,
} from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import inputFixtures from "../../protocol/schema/fixtures/command-input-v1.fixtures.json";
import outputFixtures from "../../protocol/schema/fixtures/command-output-v1.fixtures.json";

describe("shared Tooldeck command Schema profiles", () => {
  it("compiles the canonical manifest profile through the shared engine", () => {
    expect(createTooldeckJsonSchemaEngine().compileManifest().compiled).toBe(true);
  });

  it.each(inputFixtures.valid)("accepts input fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandInput(
      schema as TooldeckInputJsonSchema,
      "strict",
    );

    expect(result.compiled, result.compiled ? undefined : JSON.stringify(result.error)).toBe(true);
  });

  it.each(inputFixtures.invalid)("rejects input fixture: $name", ({ schema }) => {
    expect(
      createTooldeckJsonSchemaEngine().compileCommandInput(
        schema as TooldeckInputJsonSchema,
        "strict",
      ).compiled,
    ).toBe(false);
  });

  it.each(outputFixtures.valid)("accepts output fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandOutput(
      schema as unknown as TooldeckOutputJsonSchema,
    );

    expect(result.compiled, result.compiled ? undefined : JSON.stringify(result.error)).toBe(true);
  });

  it.each(outputFixtures.invalid)("rejects output fixture: $name", ({ schema }) => {
    expect(
      createTooldeckJsonSchemaEngine().compileCommandOutput(
        schema as unknown as TooldeckOutputJsonSchema,
      ).compiled,
    ).toBe(false);
  });

  it("composes both profiles and preserves nested boolean Schemas", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileManifest();
    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) return;

    const manifest: PluginManifest = {
      schemaVersion: "1.0",
      id: "dev.example.schema-profile",
      name: "Schema profile example",
      version: "1.0.0",
      runtime: { kind: "node", entry: "./dist/index.js" },
      contributes: {
        commands: [
          {
            id: "example.with-output",
            title: "With output",
            inputSchema: inputFixtures.valid[0]!.schema as TooldeckInputJsonSchema,
            outputSchema: outputFixtures.valid[0]!.schema as unknown as TooldeckOutputJsonSchema,
          },
          {
            id: "example.without-output",
            title: "Without output",
            inputSchema: { type: "object", properties: { enabled: true, hidden: false } },
          },
        ],
      },
    };

    expect(compilation.validator.validate(manifest).valid).toBe(true);
  });
});
