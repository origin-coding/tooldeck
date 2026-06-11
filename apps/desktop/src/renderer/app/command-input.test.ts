import { describe, expect, it } from "vitest";

import { getInputFields } from "./command-input";

describe("command input fields", () => {
  it("orders fields with inputSchema x-ui.fieldOrder and appends unspecified fields", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          "x-ui": {
            fieldOrder: ["second", "first"],
          },
          properties: {
            first: {
              type: "string",
            },
            second: {
              type: "string",
            },
            third: {
              type: "integer",
            },
          },
        },
      }).map((field) => field.key),
    ).toEqual(["second", "first", "third"]);
  });

  it("reads field-level inputSchema x-ui controls", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              "x-ui": {
                control: "text",
                placeholder: {
                  key: "schema.query.placeholder",
                  default: "Search text",
                },
              },
            },
            body: {
              type: "string",
              "x-ui": {
                control: "textarea",
                rows: 6,
                placeholder: "Paste JSON",
              },
            },
            count: {
              type: "integer",
              "x-ui": {
                control: "number",
              },
            },
          },
        },
      }),
    ).toMatchObject([
      {
        key: "query",
        kind: "text",
        placeholder: "Search text",
      },
      {
        key: "body",
        kind: "textarea",
        placeholder: "Paste JSON",
        rows: 6,
      },
      {
        key: "count",
        kind: "number",
      },
    ]);
  });
});
