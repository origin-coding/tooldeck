import { describe, expect, it } from "vitest";

import { parseRawCommandInputFromCliArgs } from "../src/cli";

describe("CLI command input parsing", () => {
  it("parses boolean flags and repeated options", () => {
    expect(
      parseRawCommandInputFromCliArgs({
        commandId: "regex.match",
        rawArgs: [
          "regex.match",
          "--enabled",
          "--no-dry-run",
          "--flags",
          "g",
          "--flags=i",
          "--flags",
          "m",
        ],
      }),
    ).toEqual({
      enabled: true,
      dryRun: false,
      flags: ["g", "i", "m"],
    });
  });

  it("ignores CLI-owned options before runtime coercion", () => {
    expect(
      parseRawCommandInputFromCliArgs({
        commandId: "json.format",
        rawArgs: [
          "json.format",
          "--text",
          '{"a":1}',
          "--storage",
          "test.sqlite",
          "--plugin-dir=fixtures",
        ],
        ignoredOptions: ["storage", "plugin-dir"],
      }),
    ).toEqual({
      text: '{"a":1}',
    });
  });
});
