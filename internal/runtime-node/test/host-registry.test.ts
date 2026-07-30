import { describe, expect, it } from "vitest";

import {
  type PluginHost,
  type PluginHostActivateOptions,
  PluginHostRegistry,
  type PluginRuntimeKind,
  RuntimeError,
} from "../src";

class FakePluginHost<RuntimeKind extends string> implements PluginHost<RuntimeKind> {
  readonly activations: PluginHostActivateOptions[] = [];
  readonly deactivations: string[] = [];
  readonly plugins = new Set<string>();

  constructor(
    readonly kind: RuntimeKind,
    private readonly onDispose: () => void | Promise<void> = () => {},
  ) {}

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  async activatePlugin(options: PluginHostActivateOptions): Promise<void> {
    this.activations.push(options);
    this.plugins.add(options.pluginId);
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    this.deactivations.push(pluginId);
    this.plugins.delete(pluginId);
  }

  async dispose(): Promise<void> {
    await this.onDispose();
  }
}

describe("PluginHostRegistry", () => {
  it("registers and routes a host without activating it", () => {
    const registry = new PluginHostRegistry();
    const host = new FakePluginHost<PluginRuntimeKind>("node");

    registry.register(host);

    expect(registry.get("node")).toBe(host);
    expect(registry.require("node", { pluginId: "dev.example.plugin" })).toBe(host);
    expect(host.activations).toEqual([]);
  });

  it("reports stable diagnostics when a runtime host is unavailable", () => {
    const registry = new PluginHostRegistry();

    expect(() => registry.require("node", { pluginId: "dev.example.plugin" })).toThrowError(
      expect.objectContaining({
        code: "ERR_RUNTIME_HOST_UNAVAILABLE",
        message: "Runtime host is unavailable for plugin dev.example.plugin: node",
        details: {
          pluginId: "dev.example.plugin",
          runtimeKind: "node",
          registeredRuntimeKinds: [],
        },
      }),
    );
  });

  it("sorts registered runtime kinds in unavailable-host diagnostics", () => {
    type TestRuntimeKind = "alpha" | "missing" | "node" | "zeta";

    const registry = new PluginHostRegistry<TestRuntimeKind>();

    registry.register(new FakePluginHost("zeta"));
    registry.register(new FakePluginHost("alpha"));

    expect(() => registry.require("missing", { pluginId: "dev.example.plugin" })).toThrowError(
      expect.objectContaining({
        code: "ERR_RUNTIME_HOST_UNAVAILABLE",
        details: {
          pluginId: "dev.example.plugin",
          runtimeKind: "missing",
          registeredRuntimeKinds: ["alpha", "zeta"],
        },
      }),
    );
  });

  it("rejects duplicate runtime kinds", () => {
    const registry = new PluginHostRegistry();

    registry.register(new FakePluginHost<PluginRuntimeKind>("node"));

    expect(() => registry.register(new FakePluginHost<PluginRuntimeKind>("node"))).toThrowError(
      expect.objectContaining({
        code: "ERR_ALREADY_EXISTS",
        message: "Runtime host is already registered: node",
        details: {
          runtimeKind: "node",
        },
      }),
    );
  });

  it("disposes hosts in reverse registration order", async () => {
    type TestRuntimeKind = "node" | "test";

    const calls: string[] = [];
    const registry = new PluginHostRegistry<TestRuntimeKind>();

    registry.register(
      new FakePluginHost("node", () => {
        calls.push("node");
      }),
    );
    registry.register(
      new FakePluginHost("test", () => {
        calls.push("test");
      }),
    );

    await registry.disposeAll();

    expect(calls).toEqual(["test", "node"]);
    expect(registry.get("node")).toBeUndefined();
    expect(registry.get("test")).toBeUndefined();
  });

  it("attempts every host, aggregates failures, and makes repeated disposal safe", async () => {
    type TestRuntimeKind = "node" | "test";

    const calls: string[] = [];
    const registry = new PluginHostRegistry<TestRuntimeKind>();

    registry.register(
      new FakePluginHost("node", () => {
        calls.push("node");
        throw new RuntimeError({
          code: "ERR_INVALID_ARGUMENT",
          message: "node cleanup failed",
        });
      }),
    );
    registry.register(
      new FakePluginHost("test", () => {
        calls.push("test");
        throw new Error("test cleanup failed");
      }),
    );

    await expect(registry.disposeAll()).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Failed to dispose all registered plugin hosts",
      details: {
        errors: [
          {
            runtimeKind: "test",
            code: "ERR_UNKNOWN",
            message: "test cleanup failed",
          },
          {
            runtimeKind: "node",
            code: "ERR_INVALID_ARGUMENT",
            message: "node cleanup failed",
          },
        ],
      },
    });

    expect(calls).toEqual(["test", "node"]);

    await expect(registry.disposeAll()).resolves.toBeUndefined();
    expect(calls).toEqual(["test", "node"]);
  });
});
