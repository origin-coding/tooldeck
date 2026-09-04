import {
  createTooldeckJsonSchemaEngine,
  type JsonSchemaDocument,
  type TooldeckJsonSchemaEngine,
} from "@tooldeck/json-schema";
import { describe, expect, it } from "vitest";

import { RuntimeJsonSchema } from "@/json-schema/runtime-json-schema";

describe("RuntimeJsonSchema", () => {
  it("selects strict and CLI validators without recompiling during validation", () => {
    const delegate = createTooldeckJsonSchemaEngine();
    const compileCounts = {
      manifest: 0,
      input: 0,
      output: 0,
      draft07: 0,
    };
    const engine: TooldeckJsonSchemaEngine = {
      compileManifest() {
        compileCounts.manifest += 1;
        return delegate.compileManifest();
      },
      compileCommandInput(schema, mode) {
        compileCounts.input += 1;
        return delegate.compileCommandInput(schema, mode);
      },
      compileCommandOutput(schema) {
        compileCounts.output += 1;
        return delegate.compileCommandOutput(schema);
      },
      compileDraft07<T>(schema: JsonSchemaDocument) {
        compileCounts.draft07 += 1;
        return delegate.compileDraft07<T>(schema);
      },
    };
    const schemas = new RuntimeJsonSchema(engine);
    const validators = schemas.compileCommand(
      {
        id: "json.format",
        title: "Format JSON",
        inputSchema: {
          type: "object",
          required: ["indent"],
          properties: {
            indent: { type: "integer" },
          },
        },
        outputSchema: {
          type: "object",
          required: ["status", "blocks"],
          properties: {
            status: { const: "success" },
            blocks: { type: "array" },
          },
        },
      },
      0,
    );
    const afterCommand = { ...compileCounts };

    for (const indent of [2, 4]) {
      expect(
        schemas.normalizeCommandInput({
          validators,
          input: { indent },
          commandId: "json.format",
          coercion: "none",
        }),
      ).toEqual({ indent });
      expect(() =>
        schemas.normalizeCommandInput({
          validators,
          input: { indent: String(indent) },
          commandId: "json.format",
          coercion: "none",
        }),
      ).toThrowError(expect.objectContaining({ code: "ERR_INVALID_ARGUMENT" }));
      expect(
        schemas.normalizeCommandInput({
          validators,
          input: { indent: String(indent) },
          commandId: "json.format",
          coercion: "cli",
        }),
      ).toEqual({ indent });
      schemas.validateCommandOutput({
        validator: validators.output,
        commandId: "json.format",
        result: { status: "success", blocks: [] },
      });
      expect(() =>
        schemas.validateCommandOutput({
          validator: validators.output,
          commandId: "json.format",
          result: { status: "error", blocks: [], error: { message: "Formatting failed" } },
        }),
      ).toThrowError(expect.objectContaining({ code: "ERR_COMMAND_FAILED" }));
    }

    expect(compileCounts).toEqual(afterCommand);
  });
});
