import { describe, expect, it } from "vitest";

import { ManifestIndex, PluginManager, RuntimeCommandRegistry } from "../src";
import { TestPluginHost } from "./plugin-manager-fixtures";

describe("PluginManager command output", () => {
  it("accepts a command result that matches the contributed output schema", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    manifestIndex.addPluginManifest({
      manifest: {
        schemaVersion: "1.0",
        id: "dev.example.json-tools",
        name: "JSON Tools",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./dist/index.js",
        },
        contributes: {
          commands: [
            {
              id: "json.format",
              title: "Format JSON",
              outputSchema: {
                type: "object",
                required: ["status", "blocks"],
                properties: {
                  status: {
                    const: "success",
                  },
                  blocks: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      required: ["type", "text"],
                      properties: {
                        type: {
                          const: "text",
                        },
                        text: {
                          type: "string",
                          pattern: "^formatted",
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    const pluginHost = new TestPluginHost(() => {
      commandRegistry.register("json.format", () => ({
        status: "success",
        blocks: [{ type: "text", text: "formatted JSON" }],
      }));
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(manager.runCommand({ commandId: "json.format" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "formatted JSON" }],
    });
  });

  it("rejects a command result that does not match the contributed output schema", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    manifestIndex.addPluginManifest({
      manifest: {
        schemaVersion: "1.0",
        id: "dev.example.json-tools",
        name: "JSON Tools",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./dist/index.js",
        },
        contributes: {
          commands: [
            {
              id: "json.format",
              title: "Format JSON",
              outputSchema: {
                type: "object",
                required: ["status", "blocks"],
                properties: {
                  status: {
                    const: "success",
                  },
                  blocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: {
                          pattern: "^formatted",
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    const pluginHost = new TestPluginHost(() => {
      commandRegistry.register("json.format", () => ({
        status: "success",
        blocks: [{ type: "text", text: "raw JSON" }],
      }));
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(manager.runCommand({ commandId: "json.format" })).rejects.toThrow(
      "Command output does not match outputSchema for json.format: --blocks[0].text",
    );
  });
});
