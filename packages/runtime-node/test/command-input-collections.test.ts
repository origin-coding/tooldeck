import { describe, expect, it } from "vitest";

import { normalizeCommandInput } from "../src";

describe("command input collections and composition", () => {
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
});
