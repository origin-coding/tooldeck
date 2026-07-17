import { describe, expect, it } from "vitest";

import { parseCommandInputFromCliArgs, parseRawCommandInputFromCliArgs } from "../src";

describe("CLI command input parsing", () => {
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
