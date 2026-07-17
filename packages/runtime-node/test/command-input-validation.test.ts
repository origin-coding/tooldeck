import { describe, expect, it } from "vitest";

import { normalizeCommandInput } from "../src";

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
    ).toThrow("Missing required command input: --text");

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
          issue: "missing_required",
          commandId: "json.format",
          propertyPath: "text",
          schemaKeyword: "required",
        },
      });
    }
  });

  it("rejects additional properties when JSON Schema disallows them", () => {
    expect(() =>
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
    ).toThrow("Unknown command input argument: --extra");
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

    expect(() =>
      normalizeCommandInput({
        input: {
          indent: 12,
        },
        inputSchema,
      }),
    ).toThrow("Command input is above maximum: --indent");

    expect(() =>
      normalizeCommandInput({
        input: {
          mode: "invalid",
        },
        inputSchema,
      }),
    ).toThrow("Invalid value for command input: --mode");

    expect(() =>
      normalizeCommandInput({
        input: {
          name: "A",
        },
        inputSchema,
      }),
    ).toThrow("Command input is shorter than minLength: --name");

    expect(() =>
      normalizeCommandInput({
        input: {
          name: "abc123",
        },
        inputSchema,
      }),
    ).toThrow("Command input does not match pattern: --name");
  });
});
