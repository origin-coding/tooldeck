import { fileURLToPath } from "node:url";

import { Cause, Effect, Exit, Fiber, Scope } from "effect";
import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effect";
import { NodePluginHost, RuntimeCommandRegistry } from "@/index";

import { createTestScope } from "./scope-test-fixtures";

function createHost(): NodePluginHost {
  return new NodePluginHost({
    commandRegistry: new RuntimeCommandRegistry(),
    scope: createTestScope(),
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

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.valid",
        entryPath,
      }),
    );

    const activePlugin = host.getPlugin("dev.example.valid")!;

    expect(host.kind).toBe("node");
    expect(activePlugin.pluginId).toBe("dev.example.valid");
    expect(activePlugin.entryPath).toBe(entryPath);
    expect(activePlugin.context.pluginId).toBe("dev.example.valid");
    expect(host.hasPlugin("dev.example.valid")).toBe(true);
    expect(host.listPlugins()).toHaveLength(1);
    expect(module.calls).toEqual(["activate:dev.example.valid"]);
  });

  it("injects plugin-scoped storage during activation", async () => {
    const values = new Map<string, unknown>();
    const host = new NodePluginHost({
      commandRegistry: new RuntimeCommandRegistry(),
      scope: createTestScope(),
      createPluginStorage(pluginId) {
        return {
          async get(key) {
            return values.get(`${pluginId}:${key}`);
          },
          async set(key, value) {
            values.set(`${pluginId}:${key}`, value);
          },
          async delete(key) {
            values.delete(`${pluginId}:${key}`);
          },
        };
      },
    });
    const module = await import(new URL("./fixtures/storage-plugin.mjs", import.meta.url).href);

    module.calls.length = 0;

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.storage-a",
        entryPath: fixturePath("storage-plugin.mjs"),
      }),
    );
    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.storage-b",
        entryPath: fixturePath("storage-plugin.mjs"),
      }),
    );

    expect(values.get("dev.example.storage-a:activated")).toBe("dev.example.storage-a");
    expect(values.get("dev.example.storage-b:activated")).toBe("dev.example.storage-b");
    expect(module.calls).toEqual([
      "storage:dev.example.storage-a",
      "storage:dev.example.storage-b",
    ]);
  });

  it("throws when activating the same plugin twice", async () => {
    const host = createHost();
    const entryPath = fixturePath("valid-plugin.mjs");

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.duplicate",
        entryPath,
      }),
    );

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.duplicate",
          entryPath,
        }),
      ),
    ).rejects.toThrow("Plugin is already active: dev.example.duplicate");
  });

  it("throws when entryPath is relative", async () => {
    const host = createHost();

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.relative",
          entryPath: "./fixtures/valid-plugin.mjs",
        }),
      ),
    ).rejects.toThrow("Node plugin entryPath must be absolute: ./fixtures/valid-plugin.mjs");
  });

  it("throws when the default export is not a valid plugin", async () => {
    const host = createHost();

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.invalid",
          entryPath: fixturePath("invalid-plugin.mjs"),
        }),
      ),
    ).rejects.toThrow("Plugin entry does not export a valid default plugin");
  });

  it("deactivates plugins and disposes subscriptions", async () => {
    const host = createHost();
    const module = await import(new URL("./fixtures/valid-plugin.mjs", import.meta.url).href);

    module.calls.length = 0;

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.lifecycle",
        entryPath: fixturePath("valid-plugin.mjs"),
      }),
    );

    await runRuntimeEffectPromise(host.deactivatePlugin("dev.example.lifecycle"));

    expect(host.hasPlugin("dev.example.lifecycle")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.lifecycle",
      "deactivate:dev.example.lifecycle",
      "dispose:dev.example.lifecycle",
    ]);
  });

  it("closes a plugin Scope when its parent host Scope closes", async () => {
    const hostScope = createTestScope();
    const host = new NodePluginHost({
      commandRegistry: new RuntimeCommandRegistry(),
      scope: hostScope,
    });
    const module = await import(new URL("./fixtures/valid-plugin.mjs", import.meta.url).href);

    module.calls.length = 0;

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.parent-scope",
        entryPath: fixturePath("valid-plugin.mjs"),
      }),
    );

    await runRuntimeEffectPromise(Scope.close(hostScope, Exit.succeed(undefined)));

    expect(module.calls).toEqual([
      "activate:dev.example.parent-scope",
      "deactivate:dev.example.parent-scope",
      "dispose:dev.example.parent-scope",
    ]);

    await runRuntimeEffectPromise(host.dispose());

    expect(host.hasPlugin("dev.example.parent-scope")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.parent-scope",
      "deactivate:dev.example.parent-scope",
      "dispose:dev.example.parent-scope",
    ]);
  });

  it("disposes subscriptions when activation fails", async () => {
    const host = createHost();
    const module = await import(
      new URL("./fixtures/activation-fails-plugin.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.activation-fails",
          entryPath: fixturePath("activation-fails-plugin.mjs"),
        }),
      ),
    ).rejects.toThrow("Failed to activate plugin: dev.example.activation-fails");

    expect(host.hasPlugin("dev.example.activation-fails")).toBe(false);
    expect(module.calls).toEqual(["dispose:dev.example.activation-fails"]);
  });

  it("closes the plugin Scope when activation is interrupted", async () => {
    const host = createHost();
    const module = await import(
      new URL("./fixtures/interruptible-activation-plugin.mjs", import.meta.url).href
    );

    module.reset();

    const fiber = Effect.runFork(
      host.activatePlugin({
        pluginId: "dev.example.interrupted",
        entryPath: fixturePath("interruptible-activation-plugin.mjs"),
      }),
    );

    await module.activationStarted;

    const exit = await Effect.runPromise(Fiber.interrupt(fiber));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    expect(host.hasPlugin("dev.example.interrupted")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.interrupted",
      "dispose:dev.example.interrupted",
    ]);
  });

  it("continues disposing subscriptions after one fails", async () => {
    const host = createHost();
    const module = await import(
      new URL("./fixtures/dispose-subscriptions-fail-plugin.mjs", import.meta.url).href
    );

    module.calls.length = 0;
    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.subscription-cleanup",
        entryPath: fixturePath("dispose-subscriptions-fail-plugin.mjs"),
      }),
    );

    await expect(
      runRuntimeEffectPromise(host.deactivatePlugin("dev.example.subscription-cleanup")),
    ).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      details: {
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "subscriptions.dispose",
            context: { pluginId: "dev.example.subscription-cleanup" },
            error: {
              source: "runtime",
              code: "ERR_PLUGIN_LOAD_FAILED",
              details: {
                cleanupFailures: [
                  {
                    phase: "cleanup",
                    step: "subscription.dispose",
                    context: { pluginId: "dev.example.subscription-cleanup" },
                    error: {
                      source: "runtime",
                      code: "ERR_UNKNOWN",
                      message: "subscription cleanup failed",
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
    expect(module.calls).toEqual(["dispose:last", "dispose:failing", "dispose:first"]);
    expect(host.hasPlugin("dev.example.subscription-cleanup")).toBe(false);
  });

  it("preserves activation failures when subscription cleanup also fails", async () => {
    const host = createHost();

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.activation-cleanup-fails",
          entryPath: fixturePath("activation-and-dispose-fail-plugin.mjs"),
        }),
      ),
    ).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Failed to activate plugin: dev.example.activation-cleanup-fails",
      cause: expect.objectContaining({
        cause: expect.objectContaining({
          message: "Failed to activate plugin: dev.example.activation-cleanup-fails",
          cause: expect.objectContaining({ message: "activation failed at source" }),
        }),
      }),
      details: {
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "subscriptions.dispose",
            context: { pluginId: "dev.example.activation-cleanup-fails" },
            error: {
              source: "runtime",
              code: "ERR_PLUGIN_LOAD_FAILED",
              details: {
                cleanupFailures: [
                  {
                    phase: "cleanup",
                    step: "subscription.dispose",
                    context: { pluginId: "dev.example.activation-cleanup-fails" },
                  },
                ],
              },
            },
          },
        ],
      },
    });
  });

  it("records multiple activation cleanup failures in reverse attempt order", async () => {
    const host = createHost();
    const module = await import(
      new URL("./fixtures/activation-and-multiple-dispose-fail-plugin.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    await expect(
      runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: "dev.example.activation-multiple-cleanup-fails",
          entryPath: fixturePath("activation-and-multiple-dispose-fail-plugin.mjs"),
        }),
      ),
    ).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Failed to activate plugin: dev.example.activation-multiple-cleanup-fails",
      details: {
        cleanupFailures: [
          {
            step: "subscriptions.dispose",
            error: {
              details: {
                cleanupFailures: [
                  { step: "subscription.dispose", error: { message: "second disposal failed" } },
                  { step: "subscription.dispose", error: { message: "first disposal failed" } },
                ],
              },
            },
          },
        ],
      },
    });
    expect(module.calls).toEqual(["dispose:second", "dispose:first"]);
  });

  it("disposes all plugins in reverse activation order", async () => {
    const host = createHost();
    const pluginA = await import(new URL("./fixtures/dispose-all-a.mjs", import.meta.url).href);
    const pluginB = await import(new URL("./fixtures/dispose-all-b.mjs", import.meta.url).href);

    pluginA.calls.length = 0;
    pluginB.calls.length = 0;

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.a",
        entryPath: fixturePath("dispose-all-a.mjs"),
      }),
    );
    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.b",
        entryPath: fixturePath("dispose-all-b.mjs"),
      }),
    );

    await runRuntimeEffectPromise(host.dispose());

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

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.failing",
        entryPath: fixturePath("deactivate-fails-plugin.mjs"),
      }),
    );
    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.b-for-error",
        entryPath: fixturePath("dispose-all-b.mjs"),
      }),
    );

    await expect(runRuntimeEffectPromise(host.disposeAll())).rejects.toMatchObject({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Failed to dispose all active plugins",
      details: {
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "plugin.dispose",
            context: { pluginId: "dev.example.failing" },
            error: {
              source: "runtime",
              code: "ERR_PLUGIN_LOAD_FAILED",
              message: "Failed to deactivate plugin: dev.example.failing",
              details: {
                cleanupFailures: [
                  {
                    step: "plugin.deactivate",
                    context: { pluginId: "dev.example.failing" },
                  },
                ],
              },
            },
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
