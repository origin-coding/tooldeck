import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { CommandRegistry, ManifestIndex, PluginManager } from "../src";
import type { PluginHost, PluginHostActivateOptions } from "../src";

function createManifest(id: string, commandIds: string[] = []): PluginManifest {
  return {
    schemaVersion: "1.0",
    id,
    name: id,
    version: "0.0.0",
    runtime: {
      kind: "node",
      entry: "./dist/index.js",
    },
    contributes: {
      commands: commandIds.map((commandId) => ({
        id: commandId,
        title: commandId,
      })),
    },
  };
}

function addManifest(index: ManifestIndex, manifest: PluginManifest): void {
  index.addPluginManifest({
    manifest,
    manifestPath: `plugins/${manifest.id}/manifest.json`,
    entryPath: `plugins/${manifest.id}/dist/index.js`,
  });
}

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

describe("PluginManager", () => {
  it("activates the owning plugin before running a contributed command", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

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
  });

  it("normalizes command input from the contributed command schema", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

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

  it("rejects invalid input before activating the plugin", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

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
    const commandRegistry = new CommandRegistry();

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

  it("does not activate a plugin when the command is already registered", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    commandRegistry.register("json.format", () => ({
      status: "success",
      blocks: [{ type: "text", text: "already registered" }],
    }));

    const pluginHost = new TestPluginHost(() => {
      throw new Error("Should not activate");
    });

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(manager.runCommand({ commandId: "json.format" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "already registered" }],
    });

    expect(pluginHost.activations).toEqual([]);
  });

  it("throws when a command is not contributed by any plugin", async () => {
    const manager = new PluginManager({
      manifestIndex: new ManifestIndex(),
      commandRegistry: new CommandRegistry(),
      pluginHost: new TestPluginHost(() => {}),
    });

    await expect(manager.runCommand({ commandId: "json.missing" })).rejects.toThrow(
      "Command is not contributed by any plugin: json.missing",
    );
  });

  it("throws when the plugin does not register the command during activation", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost: new TestPluginHost(() => {}),
    });

    await expect(manager.runCommand({ commandId: "json.format" })).rejects.toThrow(
      "Plugin did not register command after activation: json.format",
    );
  });

  it("wraps lazy activation errors with tryRunCommand", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new CommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost: new TestPluginHost(() => {}),
    });

    await expect(manager.tryRunCommand({ commandId: "json.format" })).resolves.toMatchObject({
      ok: false,
      error: {
        code: "ERR_COMMAND_NOT_FOUND",
        message: "Plugin did not register command after activation: json.format",
      },
      result: {
        status: "error",
        blocks: [],
        error: {
          code: "ERR_COMMAND_NOT_FOUND",
          message: "Plugin did not register command after activation: json.format",
        },
      },
    });
  });
});
