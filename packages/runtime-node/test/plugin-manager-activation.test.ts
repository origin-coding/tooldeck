import { describe, expect, it } from "vitest";

import { ManifestIndex, PluginManager, RuntimeCommandRegistry } from "../src";
import { addManifest, createManifest, TestPluginHost } from "./plugin-manager-fixtures";

describe("PluginManager activation", () => {
  it("activates the owning plugin before running a contributed command", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const pluginHost = new TestPluginHost(() => {
      commandRegistry.register("json.format", (input) => ({
        status: "success",
        blocks: [{ type: "text", text: String(input.text) }],
      }));
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(
      manager.runCommand({
        commandId: "json.format",
        input: { text: "formatted" },
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "formatted" }],
    });

    expect(pluginHost.activations).toEqual([
      {
        pluginId: "dev.example.json-tools",
        entryPath: "plugins/dev.example.json-tools/dist/index.js",
      },
    ]);
    expect(manager.getPluginRuntimeState("dev.example.json-tools")).toBe("active");
  });

  it("normalizes command input from the contributed command schema", async () => {
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
                  indent: {
                    type: "integer",
                    default: 2,
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
      commandRegistry.register("json.format", (input) => ({
        status: "success",
        blocks: [{ type: "text", text: JSON.stringify(input) }],
      }));
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(
      manager.runCommand({
        commandId: "json.format",
        input: { text: "{}" },
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: JSON.stringify({ text: "{}", indent: 2 }) }],
    });
  });
});
