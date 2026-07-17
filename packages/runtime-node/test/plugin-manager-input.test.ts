import { describe, expect, it } from "vitest";

import { ManifestIndex, PluginManager, RuntimeCommandRegistry } from "../src";
import { TestPluginHost } from "./plugin-manager-fixtures";

describe("PluginManager command input", () => {
  it("rejects invalid input before activating the plugin", async () => {
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
              inputSchema: {
                type: "object",
                required: ["text"],
                additionalProperties: false,
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
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    const pluginHost = new TestPluginHost(() => {
      throw new Error("Should not activate");
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(
      manager.runCommand({
        commandId: "json.format",
        input: { text: "{}", extra: true },
      }),
    ).rejects.toThrow("Unknown command input argument: --extra");
    expect(pluginHost.activations).toEqual([]);
  });

  it("does not coerce CLI-style string input by default", async () => {
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
              inputSchema: {
                type: "object",
                properties: {
                  indent: {
                    type: "integer",
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

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost: new TestPluginHost(() => {
        throw new Error("Should not activate");
      }),
    });

    await expect(
      manager.runCommand({
        commandId: "json.format",
        input: { indent: "2" },
      }),
    ).rejects.toThrow("Expected integer for command input: --indent");
  });
});
