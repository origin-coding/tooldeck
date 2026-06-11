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
});
