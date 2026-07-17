import { describe, expect, it } from "vitest";

import { ManifestIndex, type PluginHost, PluginManager, RuntimeCommandRegistry } from "../src";
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

  it("coalesces concurrent activation for commands from the same plugin", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();
    const pluginId = "dev.example.concurrent";
    let active = false;
    let activationCount = 0;
    let finishActivation!: () => void;
    const activationGate = new Promise<void>((resolve) => {
      finishActivation = resolve;
    });
    const pluginHost: PluginHost = {
      hasPlugin: () => active,
      async activatePlugin() {
        activationCount += 1;
        await activationGate;
        commandRegistry.register("concurrent.first", () => ({
          status: "success",
          blocks: [{ type: "text", text: "first" }],
        }));
        commandRegistry.register("concurrent.second", () => ({
          status: "success",
          blocks: [{ type: "text", text: "second" }],
        }));
        active = true;
      },
    };

    addManifest(manifestIndex, createManifest(pluginId, ["concurrent.first", "concurrent.second"]));
    const manager = new PluginManager({ manifestIndex, commandRegistry, pluginHost });

    const first = manager.runCommand({ commandId: "concurrent.first" });
    const second = manager.runCommand({ commandId: "concurrent.second" });

    expect(activationCount).toBe(1);
    finishActivation();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "success", blocks: [{ type: "text", text: "first" }] },
      { status: "success", blocks: [{ type: "text", text: "second" }] },
    ]);
    expect(manager.getPluginRuntimeState(pluginId)).toBe("active");
  });

  it("shares activation failures and allows a later retry", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();
    const pluginId = "dev.example.concurrent-retry";
    const activationError = new Error("concurrent activation failed");
    let active = false;
    let activationCount = 0;
    let shouldFail = true;
    const pluginHost: PluginHost = {
      hasPlugin: () => active,
      async activatePlugin() {
        activationCount += 1;
        await Promise.resolve();

        if (shouldFail) {
          throw activationError;
        }

        commandRegistry.register("concurrent.retry", () => ({
          status: "success",
          blocks: [{ type: "text", text: "retried" }],
        }));
        active = true;
      },
    };

    addManifest(manifestIndex, createManifest(pluginId, ["concurrent.retry"]));
    const manager = new PluginManager({ manifestIndex, commandRegistry, pluginHost });

    const failures = await Promise.allSettled([
      manager.runCommand({ commandId: "concurrent.retry" }),
      manager.runCommand({ commandId: "concurrent.retry" }),
    ]);

    expect(activationCount).toBe(1);
    expect(failures).toEqual([
      { status: "rejected", reason: activationError },
      { status: "rejected", reason: activationError },
    ]);
    expect(manager.getPluginRuntimeState(pluginId)).toBe("failed");

    shouldFail = false;
    await expect(manager.runCommand({ commandId: "concurrent.retry" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "retried" }],
    });
    expect(activationCount).toBe(2);
    expect(manager.getPluginRuntimeState(pluginId)).toBe("active");
  });
});
