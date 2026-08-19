import { describe, expect, it } from "vitest";

import { expectCommandInputIssues, normalizeCommandInput } from "./command-input-fixtures";

describe("nested command input", () => {
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
    expectCommandInputIssues(
      () =>
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
        }),
      [{ code: "json-schema.additional-property", propertyPath: "format.extra" }],
    );
  });
});
