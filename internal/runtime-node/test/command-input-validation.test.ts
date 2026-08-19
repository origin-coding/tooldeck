import { describe, expect, it } from "vitest";

import { expectCommandInputIssues, normalizeCommandInput } from "./command-input-fixtures";

describe("command input validation", () => {
  it("throws when required inputs are missing", () => {
    expect(() =>
      normalizeCommandInput({
        commandId: "json.format",
        input: {},
        inputSchema: {
          type: "object",
          required: ["text"],
          properties: {
            text: {
              type: "string",
            },
          },
        },
      }),
    ).toThrow("Invalid command input for json.format");

    try {
      normalizeCommandInput({
        commandId: "json.format",
        input: {},
        inputSchema: {
          type: "object",
          required: ["text"],
          properties: {
            text: {
              type: "string",
            },
          },
        },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_INVALID_ARGUMENT",
        details: {
          issue: "invalid_command_input",
          commandId: "json.format",
          schemaError: {
            kind: "validation",
            issues: expect.arrayContaining([
              expect.objectContaining({
                code: "json-schema.required",
                propertyPath: "text",
              }),
            ]),
          },
        },
      });
    }
  });

  it("rejects additional properties when JSON Schema disallows them", () => {
    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          commandId: "json.format",
          input: {
            text: "{}",
            extra: true,
          },
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: {
                type: "string",
              },
            },
          },
        }),
      [{ code: "json-schema.additional-property", propertyPath: "extra" }],
    );
  });

  it("validates number range, enum, string length, and pattern", () => {
    const inputSchema = {
      type: "object" as const,
      properties: {
        indent: {
          type: "integer" as const,
          minimum: 0,
          maximum: 8,
        },
        mode: {
          type: "string" as const,
          enum: ["compact", "pretty"],
        },
        name: {
          type: "string" as const,
          minLength: 2,
          maxLength: 8,
          pattern: "^[a-z]+$",
        },
      },
    };

    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          input: {
            indent: 12,
          },
          inputSchema,
        }),
      [{ code: "json-schema.maximum", propertyPath: "indent" }],
    );

    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          input: {
            mode: "invalid",
          },
          inputSchema,
        }),
      [{ code: "json-schema.enum", propertyPath: "mode" }],
    );

    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          input: {
            name: "A",
          },
          inputSchema,
        }),
      [{ code: "json-schema.min-length", propertyPath: "name" }],
    );

    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          input: {
            name: "abc123",
          },
          inputSchema,
        }),
      [{ code: "json-schema.pattern", propertyPath: "name" }],
    );
  });
});
