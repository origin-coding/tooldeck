import { fileURLToPath } from "node:url";

import { CommandRegistry } from "@tooldeck/core";
import { describe, expect, it } from "vitest";
import { NodePluginHost } from "../src";

function createHost(): NodePluginHost {
  return new NodePluginHost({
    commandRegistry: new CommandRegistry(),
  });
}

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

describe("NodePluginHost", () => {
  it("loads a valid default plugin and activates it", async () => {
    const host = createHost();
    const entryPath = fixturePath("valid-plugin.mjs");
    const module = await import(new URL("./fixtures/valid-plugin.mjs", import.meta.url).href);

    module.calls.length = 0;

    const activePlugin = await host.activatePlugin({
      pluginId: "dev.example.valid",
      entryPath,
    });

    expect(activePlugin.pluginId).toBe("dev.example.valid");
    expect(activePlugin.entryPath).toBe(entryPath);
    expect(activePlugin.context.pluginId).toBe("dev.example.valid");
    expect(host.hasPlugin("dev.example.valid")).toBe(true);
    expect(host.getPlugin("dev.example.valid")).toBe(activePlugin);
    expect(host.listPlugins()).toHaveLength(1);
    expect(module.calls).toEqual(["activate:dev.example.valid"]);
  });

  it("throws when activating the same plugin twice", async () => {
    const host = createHost();
    const entryPath = fixturePath("valid-plugin.mjs");

    await host.activatePlugin({
      pluginId: "dev.example.duplicate",
      entryPath,
    });

    await expect(
      host.activatePlugin({
        pluginId: "dev.example.duplicate",
        entryPath,
      }),
    ).rejects.toThrow("Plugin is already active: dev.example.duplicate");
  });

  it("throws when entryPath is relative", async () => {
    const host = createHost();

    await expect(
      host.activatePlugin({
        pluginId: "dev.example.relative",
        entryPath: "./fixtures/valid-plugin.mjs",
      }),
    ).rejects.toThrow("Node plugin entryPath must be absolute: ./fixtures/valid-plugin.mjs");
  });

  it("throws when the default export is not a valid plugin", async () => {
    const host = createHost();

    await expect(
      host.activatePlugin({
        pluginId: "dev.example.invalid",
        entryPath: fixturePath("invalid-plugin.mjs"),
      }),
    ).rejects.toThrow("Plugin entry does not export a valid default plugin");
  });

  it("deactivates plugins and disposes subscriptions", async () => {
    const host = createHost();
    const module = await import(new URL("./fixtures/valid-plugin.mjs", import.meta.url).href);

    module.calls.length = 0;

    await host.activatePlugin({
      pluginId: "dev.example.lifecycle",
      entryPath: fixturePath("valid-plugin.mjs"),
    });

    await host.deactivatePlugin("dev.example.lifecycle");

    expect(host.hasPlugin("dev.example.lifecycle")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.lifecycle",
      "deactivate:dev.example.lifecycle",
      "dispose:dev.example.lifecycle",
    ]);
  });

  it("disposes subscriptions when activation fails", async () => {
    const host = createHost();
    const module = await import(
      new URL("./fixtures/activation-fails-plugin.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    await expect(
      host.activatePlugin({
        pluginId: "dev.example.activation-fails",
        entryPath: fixturePath("activation-fails-plugin.mjs"),
      }),
    ).rejects.toThrow("Failed to activate plugin: dev.example.activation-fails");

    expect(host.hasPlugin("dev.example.activation-fails")).toBe(false);
    expect(module.calls).toEqual(["dispose:dev.example.activation-fails"]);
  });

  it("disposes all plugins in reverse activation order", async () => {
    const host = createHost();
    const pluginA = await import(new URL("./fixtures/dispose-all-a.mjs", import.meta.url).href);
    const pluginB = await import(new URL("./fixtures/dispose-all-b.mjs", import.meta.url).href);

    pluginA.calls.length = 0;
    pluginB.calls.length = 0;

    await host.activatePlugin({
      pluginId: "dev.example.a",
      entryPath: fixturePath("dispose-all-a.mjs"),
    });
    await host.activatePlugin({
      pluginId: "dev.example.b",
      entryPath: fixturePath("dispose-all-b.mjs"),
    });

    await host.disposeAll();

    expect(host.listPlugins()).toHaveLength(0);
    expect(pluginA.calls).toEqual([
      "activate:dev.example.a",
      "deactivate:dev.example.a",
      "dispose:dev.example.a",
    ]);
    expect(pluginB.calls).toEqual([
      "activate:dev.example.b",
      "deactivate:dev.example.b",
      "dispose:dev.example.b",
    ]);
  });

  it("continues disposing remaining plugins and reports aggregated errors", async () => {
    const host = createHost();
    const failingPlugin = await import(
      new URL("./fixtures/deactivate-fails-plugin.mjs", import.meta.url).href
    );
    const pluginB = await import(new URL("./fixtures/dispose-all-b.mjs", import.meta.url).href);

    failingPlugin.calls.length = 0;
    pluginB.calls.length = 0;

    await host.activatePlugin({
      pluginId: "dev.example.failing",
      entryPath: fixturePath("deactivate-fails-plugin.mjs"),
    });
    await host.activatePlugin({
      pluginId: "dev.example.b-for-error",
      entryPath: fixturePath("dispose-all-b.mjs"),
    });

    await expect(host.disposeAll()).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Failed to dispose all active plugins",
      details: {
        errors: [
          {
            pluginId: "dev.example.failing",
            code: "ERR_PLUGIN_LOAD_FAILED",
            message: "Failed to deactivate plugin: dev.example.failing",
          },
        ],
      },
    });

    expect(host.listPlugins()).toHaveLength(0);
    expect(failingPlugin.calls).toEqual([
      "activate:dev.example.failing",
      "deactivate:dev.example.failing",
      "dispose:dev.example.failing",
    ]);
    expect(pluginB.calls).toEqual([
      "activate:dev.example.b-for-error",
      "deactivate:dev.example.b-for-error",
      "dispose:dev.example.b-for-error",
    ]);
  });
});
