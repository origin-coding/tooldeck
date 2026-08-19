import { describe, expect, it } from "vitest";

import { prefixJsonSchemaError, type JsonSchemaCompilationError } from "../src";

describe("JSON Schema error context", () => {
  it("prefixes every issue path without mutating the caller-owned error", () => {
    const error: JsonSchemaCompilationError = {
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
        {
          code: "json-schema.type",
          instancePath: "/properties/0",
          propertyPath: "properties[0]",
          keyword: "type",
          message: "Value has the wrong type",
        },
      ],
    };

    const prefixed = prefixJsonSchemaError(error, {
      instancePath: "/contributes/commands/0/inputSchema",
      propertyPath: "contributes.commands[0].inputSchema",
    });

    expect(prefixed).toEqual({
      ...error,
      issues: [
        {
          ...error.issues[0],
          instancePath: "/contributes/commands/0/inputSchema",
          propertyPath: "contributes.commands[0].inputSchema",
        },
        {
          ...error.issues[1],
          instancePath: "/contributes/commands/0/inputSchema/properties/0",
          propertyPath: "contributes.commands[0].inputSchema.properties[0]",
        },
      ],
    });
    expect(prefixed).not.toBe(error);
    expect(prefixed.issues[0]).not.toBe(error.issues[0]);
    expect(error.issues[0]!.instancePath).toBe("");
  });
});
