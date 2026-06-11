import { describe, expect, it } from "vitest";

import {
  normalizeCommandInput,
  parseCommandInputFromCliArgs,
  parseRawCommandInputFromCliArgs,
} from "../src";

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

  it("parses raw CLI args without applying schema defaults", () => {
    expect(
      parseRawCommandInputFromCliArgs({
        commandId: "json.format",
        rawArgs: ["json.format", "--text", '{"a":1}', "--storage", "test.sqlite"],
        ignoredOptions: ["storage"],
      }),
    ).toEqual({
      text: '{"a":1}',
    });
  });

  it("does not coerce string values by default", () => {
    expect(() =>
      normalizeCommandInput({
        commandId: "json.format",
        input: {
          indent: "2",
        },
        inputSchema: {
          type: "object",
          properties: {
            indent: {
              type: "integer",
            },
          },
        },
      }),
    ).toThrow("Expected integer for command input: --indent");
  });

  it("coerces CLI string values when CLI coercion is enabled", () => {
    expect(
      normalizeCommandInput({
        commandId: "json.format",
        coercion: "cli",
        input: {
          indent: "2",
          pretty: "true",
        },
        inputSchema: {
          type: "object",
          properties: {
            indent: {
              type: "integer",
            },
            pretty: {
              type: "boolean",
            },
          },
        },
      }),
    ).toEqual({
      indent: 2,
      pretty: true,
    });
  });

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

  it("normalizes nested object inputs and applies nested defaults", () => {
    expect(
      normalizeCommandInput({
        commandId: "json.format",
        coercion: "cli",
        input: {
          format: {
            enabled: "true",
          },
        },
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "object",
              required: ["enabled"],
              additionalProperties: false,
              properties: {
                enabled: {
                  type: "boolean",
                },
                indent: {
                  type: "integer",
                  default: 2,
                },
              },
            },
          },
        },
      }),
    ).toEqual({
      format: {
        enabled: true,
        indent: 2,
      },
    });
  });

  it("does not create missing parent objects only because nested defaults exist", () => {
    expect(
      normalizeCommandInput({
        input: {},
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "object",
              properties: {
                indent: {
                  type: "integer",
                  default: 2,
                },
              },
            },
          },
        },
      }),
    ).toEqual({});
  });

  it("reports nested object property paths", () => {
    try {
      normalizeCommandInput({
        commandId: "json.format",
        input: {
          format: {
            extra: true,
          },
        },
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "object",
              additionalProperties: false,
              properties: {},
            },
          },
        },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_INVALID_ARGUMENT",
        details: {
          issue: "unknown_property",
          commandId: "json.format",
          propertyPath: "format.extra",
          schemaKeyword: "additionalProperties",
        },
      });
    }
  });

  it("normalizes arrays with item schemas and validates item constraints", () => {
    expect(
      normalizeCommandInput({
        commandId: "numbers.sum",
        coercion: "cli",
        input: {
          values: ["1", "2"],
        },
        inputSchema: {
          type: "object",
          properties: {
            values: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              uniqueItems: true,
              items: {
                type: "integer",
              },
            },
          },
        },
      }),
    ).toEqual({
      values: [1, 2],
    });
  });

  it("reports array item paths", () => {
    try {
      normalizeCommandInput({
        commandId: "numbers.sum",
        coercion: "cli",
        input: {
          values: ["invalid"],
        },
        inputSchema: {
          type: "object",
          properties: {
            values: {
              type: "array",
              items: {
                type: "integer",
              },
            },
          },
        },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_INVALID_ARGUMENT",
        details: {
          issue: "invalid_type",
          propertyPath: "values[0]",
        },
      });
    }
  });

  it("validates unique array items", () => {
    expect(() =>
      normalizeCommandInput({
        input: {
          values: [1, 1],
        },
        inputSchema: {
          type: "object",
          properties: {
            values: {
              type: "array",
              uniqueItems: true,
            },
          },
        },
      }),
    ).toThrow("Command input has duplicate items: --values");
  });

  it("validates const values", () => {
    expect(() =>
      normalizeCommandInput({
        input: {
          mode: "compact",
        },
        inputSchema: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              const: "pretty",
            },
          },
        },
      }),
    ).toThrow("Invalid const value for command input: --mode");
  });

  it("applies allOf schemas in order", () => {
    expect(
      normalizeCommandInput({
        commandId: "json.format",
        coercion: "cli",
        input: {
          indent: "2",
        },
        inputSchema: {
          type: "object",
          allOf: [
            {
              type: "object",
              properties: {
                indent: {
                  type: "integer",
                  minimum: 0,
                },
              },
            },
            {
              type: "object",
              properties: {
                indent: {
                  type: "integer",
                  maximum: 8,
                },
              },
            },
          ],
        },
      }),
    ).toEqual({
      indent: 2,
    });
  });

  it("supports allOf without requiring an outer type", () => {
    expect(
      normalizeCommandInput({
        commandId: "json.format",
        coercion: "cli",
        input: {
          options: {
            indent: "2",
          },
        },
        inputSchema: {
          allOf: [
            {
              properties: {
                options: {
                  properties: {
                    indent: {
                      type: "integer",
                      minimum: 0,
                    },
                  },
                },
              },
            },
            {
              properties: {
                options: {
                  properties: {
                    indent: {
                      type: "integer",
                      maximum: 8,
                    },
                  },
                },
              },
            },
          ],
        },
      }),
    ).toEqual({
      options: {
        indent: 2,
      },
    });
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

  it("parses repeated CLI options as arrays for multi-value inputs", () => {
    expect(
      parseRawCommandInputFromCliArgs({
        commandId: "regex.match",
        rawArgs: [
          "regex.match",
          "--flags",
          "g",
          "--flags=i",
          "--flags",
          "m",
          "--max-matches",
          "10",
        ],
      }),
    ).toEqual({
      flags: ["g", "i", "m"],
      maxMatches: "10",
    });

    expect(
      parseCommandInputFromCliArgs({
        commandId: "regex.match",
        rawArgs: [
          "regex.match",
          "--flags",
          "g",
          "--flags=i",
          "--flags",
          "m",
          "--max-matches",
          "10",
        ],
        inputSchema: {
          type: "object",
          properties: {
            flags: {
              type: "array",
              uniqueItems: true,
              items: {
                type: "string",
                enum: ["g", "i", "m", "s", "u", "y"],
              },
            },
            maxMatches: {
              type: "integer",
              minimum: 1,
              maximum: 100,
            },
          },
        },
      }),
    ).toEqual({
      flags: ["g", "i", "m"],
      maxMatches: 10,
    });
  });

  it("lets JSON Schema reject repeated scalar CLI options", () => {
    expect(() =>
      parseCommandInputFromCliArgs({
        commandId: "example.render",
        rawArgs: ["example.render", "--output", "text", "--output", "code"],
        inputSchema: {
          type: "object",
          properties: {
            output: {
              type: "string",
              enum: ["text", "code"],
            },
          },
        },
      }),
    ).toThrow("Expected string for command input: --output");
  });
});
