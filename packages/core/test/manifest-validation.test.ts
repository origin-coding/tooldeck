import { describe, expect, it } from "vitest";

import { parsePluginManifestText, validatePluginManifest } from "../src";

describe("manifest validation", () => {
  it("parses and validates a plugin manifest", () => {
    expect(
      parsePluginManifestText({
        manifestPath: "plugins/hello-world/manifest.json",
        text: JSON.stringify({
          schemaVersion: "1.0",
          id: "dev.tooldeck.hello-world",
          name: "Hello World",
          version: "0.0.0",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
          contributes: {
            commands: [
              {
                id: "hello.world",
                title: "Hello World",
                outputSchema: {
                  type: "object",
                  required: ["status", "blocks"],
                  properties: {
                    status: {
                      enum: ["success", "error"],
                    },
                    blocks: {
                      type: "array",
                    },
                  },
                },
              },
            ],
          },
        }),
      }),
    ).toMatchObject({
      id: "dev.tooldeck.hello-world",
      runtime: {
        kind: "node",
      },
    });
  });

  it("throws a manifest path aware error for malformed JSON", () => {
    expect(() =>
      parsePluginManifestText({
        manifestPath: "plugins/bad/manifest.json",
        text: "{",
      }),
    ).toThrow("Plugin manifest is not valid JSON: plugins/bad/manifest.json");
  });

  it("throws a field path aware error for missing required fields", () => {
    expect(() =>
      validatePluginManifest({
        manifestPath: "plugins/bad/manifest.json",
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.bad",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
      }),
    ).toThrow("Invalid plugin manifest: / must have required property 'name'");
  });

  it("rejects invalid plugin ids, command ids, and runtime kinds", () => {
    expect(() =>
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "Invalid",
          name: "Invalid",
          version: "0.0.0",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
      }),
    ).toThrow("Invalid plugin manifest");

    expect(() =>
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.bad",
          name: "Bad",
          version: "0.0.0",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
          contributes: {
            commands: [
              {
                id: "Invalid",
                title: "Invalid",
              },
            ],
          },
        },
      }),
    ).toThrow("Invalid plugin manifest");

    expect(() =>
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.bad",
          name: "Bad",
          version: "0.0.0",
          runtime: {
            kind: "wasm",
            entry: "./dist/index.wasm",
          },
        },
      }),
    ).toThrow("Invalid plugin manifest");
  });
});
