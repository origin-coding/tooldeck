import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { RuntimeCommandRegistry, CommandService, ManifestIndex, PluginManager } from "../src";
import type { PluginHost, PluginHostActivateOptions } from "../src";

class TestPluginHost implements PluginHost {
  readonly activations: PluginHostActivateOptions[] = [];
  private readonly activePluginIds = new Set<string>();

  constructor(private readonly onActivate: (options: PluginHostActivateOptions) => void) {}

  hasPlugin(pluginId: string): boolean {
    return this.activePluginIds.has(pluginId);
  }

  async activatePlugin(options: PluginHostActivateOptions): Promise<void> {
    this.activations.push(options);
    this.activePluginIds.add(options.pluginId);
    this.onActivate(options);
  }
}

describe("CommandService", () => {
  it("returns normalized command input with the command result", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();
    const manifest: PluginManifest = {
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
    };

    manifestIndex.addPluginManifest({
      manifest,
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    const pluginHost = new TestPluginHost(() => {
      commandRegistry.register("json.format", (input) => ({
        status: "success",
        blocks: [{ type: "text", text: JSON.stringify(input) }],
      }));
    });
    const service = new CommandService({
      coercion: "cli",
      pluginManager: new PluginManager({
        manifestIndex,
        commandRegistry,
        pluginHost,
      }),
    });

    await expect(
      service.runCommand({
        commandId: "json.format",
        input: { text: "{}", indent: "2" },
      }),
    ).resolves.toEqual({
      commandId: "json.format",
      input: { text: "{}", indent: 2 },
      result: {
        status: "success",
        blocks: [{ type: "text", text: JSON.stringify({ text: "{}", indent: 2 }) }],
      },
    });
  });
});
