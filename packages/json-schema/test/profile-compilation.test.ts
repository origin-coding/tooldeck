import type {
  PluginManifest,
  TooldeckInputJsonSchema,
  TooldeckOutputJsonSchema,
} from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import inputFixtures from "../../protocol/schema/fixtures/command-input-v1.fixtures.json";
import outputFixtures from "../../protocol/schema/fixtures/command-output-v1.fixtures.json";
import { createTooldeckJsonSchemaEngine } from "../src";

describe("Tooldeck Schema profile compilation", () => {
  it.each(inputFixtures.valid)("compiles valid input fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandInput(
      schema as TooldeckInputJsonSchema,
      "strict",
    );

    expect(result.compiled, result.compiled ? undefined : JSON.stringify(result.error)).toBe(true);
  });

  it.each(inputFixtures.invalid)("rejects invalid input fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandInput(
      schema as TooldeckInputJsonSchema,
      "strict",
    );

    expect(result.compiled).toBe(false);
    expect(result.compiled ? [] : result.error.issues).not.toHaveLength(0);
  });

  it.each(outputFixtures.valid)("compiles valid output fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandOutput(
      schema as unknown as TooldeckOutputJsonSchema,
    );

    expect(result.compiled, result.compiled ? undefined : JSON.stringify(result.error)).toBe(true);
  });

  it.each(outputFixtures.invalid)("rejects invalid output fixture: $name", ({ schema }) => {
    const result = createTooldeckJsonSchemaEngine().compileCommandOutput(
      schema as TooldeckOutputJsonSchema,
    );

    expect(result.compiled).toBe(false);
    expect(result.compiled ? [] : result.error.issues).not.toHaveLength(0);
  });

  it("validates manifest profile references and Tooldeck input semantics", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileManifest();

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const validManifest: PluginManifest = {
      schemaVersion: "1.0",
      id: "dev.example.schema-profile",
      name: "Schema profile example",
      version: "1.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: "example.run",
            title: "Run",
            inputSchema: {
              type: "object",
              "x-ui": { fieldOrder: ["text"] },
              properties: {
                text: { type: "string", "x-ui": { control: "text" } },
              },
            },
          },
        ],
      },
    };

    expect(compilation.validator.validate(validManifest)).toEqual({
      valid: true,
      value: validManifest,
    });

    const invalidManifest = structuredClone(validManifest);
    invalidManifest.contributes!.commands![0]!.inputSchema!["x-ui"] = {
      fieldOrder: ["missing"],
    };

    const invalid = compilation.validator.validate(invalidManifest);

    expect(invalid.valid).toBe(false);
    expect(invalid.valid ? [] : invalid.error.issues).toContainEqual(
      expect.objectContaining({
        code: "tooldeck.input-ui.field-order.unknown-property",
        keyword: "x-ui.fieldOrder",
        propertyPath: "contributes.commands[0].inputSchema.x-ui.fieldOrder[0]",
      }),
    );
  });

  it("returns the same fixed manifest compilation within one engine", () => {
    const engine = createTooldeckJsonSchemaEngine();

    expect(engine.compileManifest()).toBe(engine.compileManifest());
  });

  it("does not accept manifest fields inherited through a __proto__ JSON property", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileManifest();

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const manifest = JSON.parse(`{
      "__proto__": {
        "schemaVersion": "1.0",
        "id": "dev.example.polluted",
        "name": "Polluted",
        "version": "1.0.0",
        "runtime": { "kind": "node", "entry": "./dist/index.js" }
      }
    }`) as unknown;
    const result = compilation.validator.validate(manifest);

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "json-schema.required", propertyPath: "id" }),
        expect.objectContaining({ code: "json-schema.required", propertyPath: "runtime" }),
      ]),
    );
  });

  it("rejects enum labels that do not map to the same Schema enum", () => {
    const result = createTooldeckJsonSchemaEngine().compileCommandInput(
      {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["safe"],
            "x-enumLabels": {
              unknown: "Unknown",
            },
          },
        },
      },
      "strict",
    );

    expect(result.compiled).toBe(false);
    expect(result.compiled ? [] : result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "tooldeck.enum-labels.unknown-value",
        keyword: "enumLabels",
        propertyPath: "properties.mode.x-enumLabels.unknown",
      }),
    );
  });

  it("classifies Tooldeck UI profile failures with stable issue codes", () => {
    const engine = createTooldeckJsonSchemaEngine();
    const unsupportedRootUi = engine.compileCommandInput(
      {
        type: "object",
        "x-ui": { layout: "vertical" },
      } as TooldeckInputJsonSchema,
      "strict",
    );
    const invalidNestedUi = engine.compileCommandInput(
      {
        type: "object",
        properties: {
          options: {
            type: "object",
            properties: {
              nested: {
                type: "string",
                "x-ui": { control: "text" },
              },
            },
          },
        },
      } as TooldeckInputJsonSchema,
      "strict",
    );
    const forbiddenOutputUi = engine.compileCommandOutput({
      type: "object",
      "x-ui": { fieldOrder: ["blocks"] },
    } as TooldeckOutputJsonSchema);
    const unsupportedControlProperty = engine.compileCommandInput(
      {
        type: "object",
        properties: {
          flag: {
            type: "boolean",
            "x-ui": { control: "checkbox", placeholder: "Unsupported" },
          },
        },
      } as TooldeckInputJsonSchema,
      "strict",
    );

    expect(unsupportedRootUi.compiled ? [] : unsupportedRootUi.error.issues).toContainEqual(
      expect.objectContaining({ code: "tooldeck.input-ui.unsupported-property" }),
    );
    expect(invalidNestedUi.compiled ? [] : invalidNestedUi.error.issues).toContainEqual(
      expect.objectContaining({ code: "tooldeck.input-ui.invalid-location" }),
    );
    expect(forbiddenOutputUi.compiled ? [] : forbiddenOutputUi.error.issues).toContainEqual(
      expect.objectContaining({ code: "tooldeck.output-ui.forbidden" }),
    );
    expect(
      unsupportedControlProperty.compiled
        ? []
        : unsupportedControlProperty.error.issues.filter(
            (issue) => issue.code === "tooldeck.input-ui.control.unsupported-property",
          ),
    ).toHaveLength(1);
  });

  it("uses the manifest structure rather than nested Schema property names for UI context", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileManifest();

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const manifest = {
      schemaVersion: "1.0",
      id: "dev.example.schema-context",
      name: "Schema context",
      version: "1.0.0",
      runtime: { kind: "node", entry: "./dist/index.js" },
      contributes: {
        commands: [
          {
            id: "context.input",
            title: "Input context",
            inputSchema: {
              type: "object",
              properties: {
                inputSchema: {
                  type: "boolean",
                  "x-ui": { control: "checkbox", placeholder: "Unsupported" },
                },
              },
            },
          },
          {
            id: "context.output",
            title: "Output context",
            outputSchema: {
              type: "object",
              properties: {
                inputSchema: {
                  type: "string",
                  "x-ui": { fieldOrder: [] },
                },
              },
            },
          },
        ],
      },
    };
    const result = compilation.validator.validate(manifest);

    expect(result.valid).toBe(false);

    if (result.valid) {
      return;
    }

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "tooldeck.input-ui.control.unsupported-property",
        propertyPath: "contributes.commands[0].inputSchema.properties.inputSchema.x-ui.placeholder",
      }),
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "tooldeck.output-ui.forbidden",
        propertyPath: "contributes.commands[1].outputSchema.properties.inputSchema.x-ui",
      }),
    );
  });
});
