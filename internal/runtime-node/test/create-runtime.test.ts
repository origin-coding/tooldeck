import { describe, expect, it } from "vitest";

import {
  createRuntime,
  NodePluginHost,
  type PluginHost,
  type RuntimeCommandRegistry,
} from "@/index";

import { fixturePath } from "./runtime-test-fixtures";

describe("createRuntime", () => {
  it("scans manifests without activation, routes commands, and disposes hosts", async () => {
    const module = await import(
      new URL("./fixtures/runtime-plugin/index.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    const afterScanCalls: Array<{ pluginCount: number; commandCount: number }> = [];
    const runtime = await createRuntime({
      pluginSources: [
        {
          kind: "builtin",
          path: fixturePath("runtime-plugin"),
        },
      ],
      afterScan({ pluginCount, commandCount }) {
        afterScanCalls.push({ pluginCount, commandCount });
      },
    });

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
      runtime.commandService.runCommand({
        commandId: "factory.echo",
        input: {
          text: "hello",
        },
      }),
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

    await runtime.dispose();

    expect(nodeHost.hasPlugin("dev.example.runtime")).toBe(false);
    expect(runtime.hostRegistry.get("node")).toBeUndefined();
    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);

    await expect(runtime.dispose()).resolves.toBeUndefined();
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
      async activatePlugin({ pluginId }) {
        activations.push(pluginId);
        activePluginIds.add(pluginId);
        factoryCommandRegistry?.register("factory.echo", (input) => ({
          status: "success",
          blocks: [{ type: "text", text: String(input.text) }],
        }));
      },
      async deactivatePlugin(pluginId) {
        activePluginIds.delete(pluginId);
      },
      async dispose() {
        activePluginIds.clear();
      },
    };

    const runtime = await createRuntime({
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
    });

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

    await runtime.dispose();
  });
});
