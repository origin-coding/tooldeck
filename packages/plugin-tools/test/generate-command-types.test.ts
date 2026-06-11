import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { generatePluginCommandTypes } from "../src";

describe("generatePluginCommandTypes", () => {
  it("wraps enum unions before array suffixes", () => {
    const manifest: PluginManifest = {
      schemaVersion: "1.0",
      id: "dev.tooldeck.test-tools",
      name: "Test Tools",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: "test.controls",
            title: "Test Controls",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                flags: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["g", "i"],
                  },
                },
              },
            },
          },
        ],
      },
    };

    expect(generatePluginCommandTypes(manifest)).toContain('flags?: ("g" | "i")[];');
  });
});
