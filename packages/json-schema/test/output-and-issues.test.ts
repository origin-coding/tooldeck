import { describe, expect, it } from "vitest";

import { createTooldeckJsonSchemaEngine } from "../src";

describe("output and neutral Draft-07 validation", () => {
  it("validates a complete CommandResult without mutating it", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileCommandOutput({
      type: "object",
      required: ["status", "blocks"],
      properties: {
        status: { const: "success" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            required: ["type", "text"],
            properties: {
              type: { const: "text" },
              text: { type: "string" },
            },
          },
        },
      },
    });

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const original = {
      status: "success" as const,
      blocks: [{ type: "text" as const, text: "ok" }],
    };
    const result = compilation.validator.validate(original);

    expect(result).toEqual({ valid: true, value: original });
    expect(result.valid && result.value).not.toBe(original);
    expect(original).toEqual({
      status: "success",
      blocks: [{ type: "text", text: "ok" }],
    });
  });

  it("normalizes required and additional-property paths", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileDraft07<{
      options: { mode: string };
    }>({
      type: "object",
      additionalProperties: false,
      required: ["options"],
      properties: {
        options: {
          type: "object",
          additionalProperties: false,
          required: ["mode"],
          properties: {
            mode: { type: "string" },
          },
        },
      },
    });

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const missing = compilation.validator.validate({ options: {} });

    expect(missing.valid ? [] : missing.issues).toContainEqual({
      instancePath: "/options",
      propertyPath: "options.mode",
      keyword: "required",
      message: "Required property is missing",
      expected: "mode",
    });

    const additional = compilation.validator.validate({
      options: { mode: "safe", "a/b~c": true },
    });

    expect(additional.valid ? [] : additional.issues).toContainEqual({
      instancePath: "/options",
      propertyPath: 'options["a/b~c"]',
      keyword: "additionalProperties",
      message: "Additional property is not allowed",
      expected: "a/b~c",
      actual: true,
    });
  });

  it("supports direct boolean Draft-07 schemas", () => {
    const engine = createTooldeckJsonSchemaEngine();
    const accepted = engine.compileDraft07<unknown>(true);
    const rejected = engine.compileDraft07<unknown>(false);

    expect(accepted.compiled && accepted.validator.validate("value").valid).toBe(true);
    expect(rejected.compiled && rejected.validator.validate("value").valid).toBe(false);
  });

  it("returns a neutral compilation issue for unresolved references", () => {
    const result = createTooldeckJsonSchemaEngine().compileDraft07({
      $ref: "https://example.com/external.schema.json",
    });

    expect(result).toEqual({
      compiled: false,
      issues: [
        {
          instancePath: "",
          propertyPath: "",
          keyword: "$ref",
          message: "Schema reference could not be resolved",
          expected: "https://example.com/external.schema.json",
        },
      ],
    });
  });

  it("supports local references in isolated static Draft-07 schemas", () => {
    const result = createTooldeckJsonSchemaEngine().compileDraft07<{ id: string }>({
      type: "object",
      required: ["id"],
      properties: {
        id: { $ref: "#/definitions/id" },
      },
      definitions: {
        id: { type: "string", minLength: 1 },
      },
    });

    expect(result.compiled).toBe(true);

    if (!result.compiled) {
      return;
    }

    expect(result.validator.validate({ id: "value" }).valid).toBe(true);
    expect(result.validator.validate({ id: "" }).valid).toBe(false);
  });
});
