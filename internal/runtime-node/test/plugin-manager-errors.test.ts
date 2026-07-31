import { describe, expect, it } from "vitest";

import { ManifestIndex, PluginHostRegistry, PluginManager, RuntimeCommandRegistry } from "@/index";

import {
  addManifest,
  createHostRegistry,
  createManifest,
  FailingPluginHost,
  TestPluginHost,
} from "./plugin-manager-fixtures";

describe("PluginManager activation errors", () => {
  it("does not activate a plugin when the command is already registered", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

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
      hostRegistry: createHostRegistry(pluginHost),
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
      commandRegistry: new RuntimeCommandRegistry(),
      hostRegistry: createHostRegistry(new TestPluginHost(() => {})),
    });

    await expect(manager.runCommand({ commandId: "json.missing" })).rejects.toThrow(
      "Command is not contributed by any plugin: json.missing",
    );
  });

  it("throws when the plugin does not register the command during activation", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      hostRegistry: createHostRegistry(new TestPluginHost(() => {})),
    });

    await expect(manager.runCommand({ commandId: "json.format" })).rejects.toThrow(
      "Plugin did not register command after activation: json.format",
    );
  });

  it("wraps lazy activation errors with tryRunCommand", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      hostRegistry: createHostRegistry(new TestPluginHost(() => {})),
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

  it("tracks failed plugin runtime state when lazy activation throws", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      hostRegistry: createHostRegistry(new FailingPluginHost()),
    });

    expect(manager.getPluginRuntimeState("dev.example.json-tools")).toBe("inactive");

    await expect(manager.runCommand({ commandId: "json.format" })).rejects.toThrow(
      "Activation failed",
    );

    expect(manager.getPluginRuntimeState("dev.example.json-tools")).toBe("failed");
  });

  it("reports the owning plugin and runtime kind when no matching host is registered", async () => {
    const manifestIndex = new ManifestIndex();
    const commandRegistry = new RuntimeCommandRegistry();

    addManifest(manifestIndex, createManifest("dev.example.json-tools", ["json.format"]));

    const manager = new PluginManager({
      manifestIndex,
      commandRegistry,
      hostRegistry: new PluginHostRegistry(),
    });

    await expect(manager.runCommand({ commandId: "json.format" })).rejects.toMatchObject({
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      details: {
        pluginId: "dev.example.json-tools",
        runtimeKind: "node",
        registeredRuntimeKinds: [],
      },
    });
    expect(manager.getPluginRuntimeState("dev.example.json-tools")).toBe("inactive");
  });
});
