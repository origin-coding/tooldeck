import {
  createTooldeckJsonSchemaEngine,
  type JsonSchemaDocument,
  type TooldeckJsonSchemaEngine,
} from "@tooldeck/json-schema";
import { describe, expect, it } from "vitest";

import { RuntimeJsonSchema } from "@/json-schema/runtime-json-schema";

describe("RuntimeJsonSchema", () => {
  it("compiles command validators once and reuses them across validation", () => {
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
    const beforeCommand = { ...compileCounts };
    const validators = schemas.compileCommand(
      {
        id: "json.format",
        title: "Format JSON",
        inputSchema: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string" },
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

    expect(afterCommand.input - beforeCommand.input).toBe(2);
    expect(afterCommand.output - beforeCommand.output).toBe(1);

    expect(
      schemas.normalizeCommandInput({
        validators,
        input: { text: "{}" },
        commandId: "json.format",
        coercion: "none",
      }),
    ).toEqual({ text: "{}" });
    expect(
      schemas.normalizeCommandInput({
        validators,
        input: { text: "[]" },
        commandId: "json.format",
        coercion: "cli",
      }),
    ).toEqual({ text: "[]" });
    schemas.validateCommandOutput({
      validator: validators.output,
      commandId: "json.format",
      result: { status: "success", blocks: [] },
    });

    expect(compileCounts).toEqual(afterCommand);
  });
});
