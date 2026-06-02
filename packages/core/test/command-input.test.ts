import { describe, expect, it } from "vitest";

import { normalizeCommandInput, parseCommandInputFromCliArgs } from "../src";

describe("command input normalization", () => {
  it("parses CLI args and applies JSON Schema defaults", () => {
    expect(
      parseCommandInputFromCliArgs({
        commandId: "json.format",
        rawArgs: ["json.format", "--text", '{"a":1}', "--indent", "4", "--storage", "test.sqlite"],
        ignoredOptions: ["storage"],
        inputSchema: {
          type: "object",
          required: ["text"],
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              minLength: 1,
            },
            indent: {
              type: "integer",
              default: 2,
              minimum: 0,
              maximum: 8,
            },
          },
        },
      }),
    ).toEqual({
      text: '{"a":1}',
      indent: 4,
    });
  });

  it("fills missing defaults after checking provided values", () => {
    expect(
      normalizeCommandInput({
        input: {
          text: "{}",
        },
        inputSchema: {
          type: "object",
          required: ["text"],
          properties: {
            text: {
              type: "string",
            },
            indent: {
              type: "integer",
              default: 2,
            },
          },
        },
      }),
    ).toEqual({
      text: "{}",
      indent: 2,
    });
  });

  it("throws when required inputs are missing", () => {
    expect(() =>
      normalizeCommandInput({
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
  });

  it("rejects additional properties when JSON Schema disallows them", () => {
    expect(() =>
      normalizeCommandInput({
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

  it("parses boolean CLI flags", () => {
    expect(
      parseCommandInputFromCliArgs({
        commandId: "example.run",
        rawArgs: ["example.run", "--enabled", "--no-dry-run"],
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
            },
            dryRun: {
              type: "boolean",
            },
          },
        },
      }),
    ).toEqual({
      enabled: true,
      dryRun: false,
    });
  });
});
