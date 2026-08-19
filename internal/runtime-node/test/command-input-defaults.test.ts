import { describe, expect, it } from "vitest";

import { expectCommandInputIssues, normalizeCommandInput } from "./command-input-fixtures";

describe("command input defaults and coercion", () => {
  it("coerces raw CLI values and applies JSON Schema defaults", () => {
    expect(
      normalizeCommandInput({
        commandId: "json.format",
        coercion: "cli",
        input: {
          text: '{"a":1}',
          indent: "4",
        },
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

  it("does not coerce string values by default", () => {
    expectCommandInputIssues(
      () =>
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
      [{ code: "json-schema.type", propertyPath: "indent" }],
    );
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

  it("rejects repeated values for scalar schema fields", () => {
    expectCommandInputIssues(
      () =>
        normalizeCommandInput({
          commandId: "example.render",
          coercion: "cli",
          input: {
            output: ["text", "code"],
          },
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
      [
        { code: "json-schema.type", propertyPath: "output" },
        { code: "json-schema.enum", propertyPath: "output" },
      ],
    );
  });
});
