import { describe, expect, it } from "vitest";

import {
  normalizeCommandInput,
  parseCommandInputFromCliArgs,
  parseRawCommandInputFromCliArgs,
} from "../src";

describe("command input defaults and coercion", () => {
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
});
