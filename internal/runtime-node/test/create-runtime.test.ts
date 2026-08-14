import { Effect, Exit, Scope } from "effect";
import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effect";
import {
  createRuntime,
  NodePluginHost,
  type PluginHost,
  type RuntimeCommandRegistry,
} from "@/index";

import { fixturePath } from "./runtime-test-fixtures";
import { createTestScope } from "./scope-test-fixtures";

describe("createRuntime", () => {
  it("scans manifests without activation, routes commands, and disposes hosts", async () => {
    const module = await import(
      new URL("./fixtures/runtime-plugin/index.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    const afterScanCalls: Array<{ pluginCount: number; commandCount: number }> = [];
    const runtime = await runRuntimeEffectPromise(
      createRuntime({
        pluginSources: [
          {
            kind: "builtin",
            path: fixturePath("runtime-plugin"),
          },
        ],
        afterScan({ pluginCount, commandCount }) {
          afterScanCalls.push({ pluginCount, commandCount });
        },
      }),
    );

    expect(runtime.pluginCount).toBe(1);
    expect(runtime.commandCount).toBe(1);
    expect(afterScanCalls).toEqual([{ pluginCount: 1, commandCount: 1 }]);
    expect(runtime.manifestIndex.hasCommand("factory.echo")).toBe(true);
    const nodeHost = runtime.hostRegistry.require("node", {
      pluginId: "dev.example.runtime",
    });

    expect(nodeHost).toBeInstanceOf(NodePluginHost);
    expect(nodeHost.hasPlugin("dev.example.runtime")).toBe(false);
    expect(module.calls).toEqual([]);

    await expect(
      runRuntimeEffectPromise(
        runtime.runCommand({
          commandId: "factory.echo",
          input: {
            text: "hello",
          },
        }),
      ),
    ).resolves.toEqual({
      commandId: "factory.echo",
      input: {
        text: "hello",
      },
      result: {
        status: "success",
        blocks: [
          {
            type: "text",
            text: "hello",
          },
        ],
      },
    });

    expect(nodeHost.hasPlugin("dev.example.runtime")).toBe(true);
    expect(module.calls).toEqual(["activate:dev.example.runtime"]);

    await expect(
      runRuntimeEffectPromise(runtime.runCommand({ commandId: "factory.missing" })),
    ).rejects.toMatchObject({
      _tag: "RuntimeError",
      code: "ERR_COMMAND_NOT_FOUND",
    });

    await runRuntimeEffectPromise(runtime.dispose());

    expect(nodeHost.hasPlugin("dev.example.runtime")).toBe(false);
    expect(runtime.hostRegistry.get("node")).toBeUndefined();
    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);

    await expect(runRuntimeEffectPromise(runtime.dispose())).resolves.toBeUndefined();
  });

  it("forks the runtime under a parent application Scope", async () => {
    const module = await import(
      new URL("./fixtures/runtime-plugin/index.mjs", import.meta.url).href
    );
    const applicationScope = createTestScope();

    module.calls.length = 0;

    const runtime = await runRuntimeEffectPromise(
      createRuntime({
        parentScope: applicationScope,
        pluginSources: [
          {
            kind: "builtin",
            path: fixturePath("runtime-plugin"),
          },
        ],
      }),
    );

    await runtime.commandService.runCommand({
      commandId: "factory.echo",
      input: { text: "parent-scope" },
    });
    await runRuntimeEffectPromise(Scope.close(applicationScope, Exit.succeed(undefined)));

    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);

    await runRuntimeEffectPromise(runtime.dispose());

    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);
  });

  it("constructs configured hosts with the runtime command registry", async () => {
    let factoryCommandRegistry: RuntimeCommandRegistry | undefined;
    const activePluginIds = new Set<string>();
    const activations: string[] = [];
    const customHost: PluginHost = {
      kind: "node",
      hasPlugin(pluginId) {
        return activePluginIds.has(pluginId);
      },
      activatePlugin({ pluginId }) {
        return Effect.sync(() => {
          activations.push(pluginId);
          activePluginIds.add(pluginId);
          factoryCommandRegistry?.register("factory.echo", (input) => ({
            status: "success",
            blocks: [{ type: "text", text: String(input.text) }],
          }));
        });
      },
      deactivatePlugin(pluginId) {
        return Effect.sync(() => {
          activePluginIds.delete(pluginId);
        });
      },
      dispose() {
        return Effect.sync(() => {
          activePluginIds.clear();
        });
      },
    };

    const runtime = await runRuntimeEffectPromise(
      createRuntime({
        pluginSources: [
          {
            kind: "builtin",
            path: fixturePath("runtime-plugin"),
          },
        ],
        hostFactories: [
          ({ commandRegistry }) => {
            factoryCommandRegistry = commandRegistry;
            return customHost;
          },
        ],
      }),
    );

    expect(factoryCommandRegistry).toBe(runtime.commandRegistry);
    expect(runtime.hostRegistry.get("node")).toBe(customHost);
    expect(activations).toEqual([]);

    await expect(
      runtime.commandService.runCommand({
        commandId: "factory.echo",
        input: {
          text: "custom",
        },
      }),
    ).resolves.toMatchObject({
      result: {
        status: "success",
        blocks: [{ type: "text", text: "custom" }],
      },
    });

    expect(activations).toEqual(["dev.example.runtime"]);

    await runRuntimeEffectPromise(runtime.dispose());
  });

  it("closes forked host Scopes when runtime creation fails", async () => {
    const calls: string[] = [];
    const host: PluginHost = {
      kind: "node",
      hasPlugin: () => false,
      activatePlugin: () => Effect.void,
      deactivatePlugin: () => Effect.void,
      dispose: () => Effect.void,
    };

    await expect(
      runRuntimeEffectPromise(
        createRuntime({
          pluginSources: [],
          hostFactories: [
            ({ scope }) => {
              Effect.runSync(
                Scope.addFinalizer(
                  scope,
                  Effect.sync(() => {
                    calls.push("host-scope-finalizer");
                  }),
                ),
              );

              return host;
            },
          ],
          afterScan() {
            throw new Error("runtime creation failed");
          },
        }),
      ),
    ).rejects.toThrow("runtime creation failed");

    expect(calls).toEqual(["host-scope-finalizer"]);
  });
});
