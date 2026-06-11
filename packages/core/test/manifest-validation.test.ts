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

  it("accepts command-level x-ui layout hints", () => {
    expect(
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.layout",
          name: "Layout",
          version: "0.0.0",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
          contributes: {
            commands: [
              {
                id: "layout.run",
                title: "Layout",
                "x-ui": {
                  layout: "split",
                },
              },
            ],
          },
        },
      }),
    ).toMatchObject({
      contributes: {
        commands: [
          {
            id: "layout.run",
            "x-ui": {
              layout: "split",
            },
          },
        ],
      },
    });
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

  it("rejects input field order entries that do not reference input properties", () => {
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
                id: "bad.run",
                title: "Bad",
                inputSchema: {
                  type: "object",
                  "x-ui": {
                    fieldOrder: ["missing"],
                  },
                  properties: {
                    text: {
                      type: "string",
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    ).toThrow("references unknown input field 'missing'");
  });

  it("rejects unsupported input schema x-ui properties", () => {
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
                id: "bad.run",
                title: "Bad",
                inputSchema: {
                  type: "object",
                  "x-ui": {
                    layout: "vertical",
                  },
                  properties: {
                    text: {
                      type: "string",
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    ).toThrow("is not a supported input schema x-ui property");
  });

  it("rejects unsupported command-level x-ui layout values", () => {
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
                id: "bad.run",
                title: "Bad",
                "x-ui": {
                  layout: "grid",
                },
              },
            ],
          },
        },
      }),
    ).toThrow("Invalid plugin manifest");
  });

  it("rejects x-ui on command output schemas", () => {
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
                id: "bad.run",
                title: "Bad",
                outputSchema: {
                  type: "object",
                  "x-ui": {
                    fieldOrder: ["blocks"],
                  },
                },
              },
            ],
          },
        },
      }),
    ).toThrow("is not supported on command output schemas");
  });

  it.each([
    ["activationEvents", { activationEvents: ["onCommand:hello.world"] }],
    [
      "permissions",
      {
        permissions: [
          {
            id: "storage:plugin",
            reason: "Store plugin data.",
          },
        ],
      },
    ],
    [
      "contributes.documents",
      {
        contributes: {
          commands: [],
          documents: [],
        },
      },
    ],
    [
      "contributes.tables",
      {
        contributes: {
          commands: [],
          tables: [],
        },
      },
    ],
    [
      "contributes.views",
      {
        contributes: {
          commands: [],
          views: [],
        },
      },
    ],
    [
      "contributes.settings",
      {
        contributes: {
          commands: [],
          settings: [],
        },
      },
    ],
    [
      "contributes.menus",
      {
        contributes: {
          commands: [],
          menus: [],
        },
      },
    ],
    [
      "contributes.fileHandlers",
      {
        contributes: {
          commands: [],
          fileHandlers: [],
        },
      },
    ],
  ])("rejects %s in the strict commands-only MVP manifest", (_name, override) => {
    expect(() =>
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.commands-only",
          name: "Commands Only",
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
              },
            ],
          },
          ...override,
        },
      }),
    ).toThrow("Invalid plugin manifest");
  });
});
