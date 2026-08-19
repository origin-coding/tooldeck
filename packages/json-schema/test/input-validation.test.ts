import type { TooldeckInputJsonSchema } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { createTooldeckJsonSchemaEngine } from "../src";

const inputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    count: {
      type: "integer",
      default: 2,
    },
    options: {
      properties: {
        enabled: {
          type: "boolean",
          default: true,
        },
      },
      default: {},
    },
  },
} satisfies TooldeckInputJsonSchema;

describe("command input validation", () => {
  it("applies defaults to a copy in strict mode without coercion", () => {
    const validator = compileInput("strict");
    const original = {};
    const result = validator.validate(original);

    expect(result).toEqual({
      valid: true,
      value: {
        count: 2,
        options: {
          enabled: true,
        },
      },
    });
    expect(original).toEqual({});

    const stringInput = { count: "2" };
    const invalid = validator.validate(stringInput);

    expect(invalid.valid).toBe(false);
    expect(stringInput).toEqual({ count: "2" });
  });

  it("applies defaults and coercion to a copy in CLI mode", () => {
    const validator = compileInput("cli");
    const original = { count: "2", options: { enabled: "false" } };
    const result = validator.validate(original);

    expect(result).toEqual({
      valid: true,
      value: {
        count: 2,
        options: {
          enabled: false,
        },
      },
    });
    expect(original).toEqual({ count: "2", options: { enabled: "false" } });
  });

  it("preserves direct boolean property Schema semantics", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileCommandInput(
      {
        type: "object",
        properties: {
          accepted: true,
          rejected: false,
        },
      },
      "strict",
    );

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    expect(compilation.validator.validate({ accepted: { nested: true } }).valid).toBe(true);

    const rejected = compilation.validator.validate({ rejected: null });

    expect(rejected.valid).toBe(false);
    expect(rejected.valid ? [] : rejected.error.issues).toContainEqual(
      expect.objectContaining({
        propertyPath: "rejected",
      }),
    );
  });

  it("rejects non-JSON-safe caller values before Ajv", () => {
    const compilation = createTooldeckJsonSchemaEngine().compileDraft07<unknown>(true);

    expect(compilation.compiled).toBe(true);

    if (!compilation.compiled) {
      return;
    }

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = compilation.validator.validate(circular);

    expect(result).toEqual({
      valid: false,
      error: {
        kind: "validation",
        code: "value_does_not_match_schema",
        message: "Value is not JSON-safe",
        issues: [
          {
            code: "json-value.not-json-safe",
            instancePath: "/self",
            propertyPath: "self",
            keyword: "json",
            message: "Value must be JSON-safe",
            actual: "circular reference",
          },
        ],
      },
    });
  });

  it("returns a neutral issue when an otherwise supported Schema cannot compile", () => {
    const result = createTooldeckJsonSchemaEngine().compileCommandInput(
      {
        type: "object",
        properties: {
          text: {
            type: "string",
            pattern: "[",
          },
        },
      },
      "strict",
    );

    expect(result).toEqual({
      compiled: false,
      error: {
        kind: "compilation",
        code: "schema_could_not_be_compiled",
        message: "JSON Schema could not be compiled",
        issues: [
          {
            code: "schema.invalid-pattern",
            instancePath: "",
            propertyPath: "",
            keyword: "pattern",
            message: "Pattern is not a valid regular expression",
          },
        ],
      },
    });
  });
});

function compileInput(mode: "strict" | "cli") {
  const compilation = createTooldeckJsonSchemaEngine().compileCommandInput(inputSchema, mode);

  expect(
    compilation.compiled,
    compilation.compiled ? undefined : JSON.stringify(compilation.error),
  ).toBe(true);

  if (!compilation.compiled) {
    throw new Error("Expected input Schema compilation to succeed");
  }

  return compilation.validator;
}
