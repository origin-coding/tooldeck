import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effect";
import { NodePluginHost, PluginHostRegistry, RuntimeCommandRegistry } from "@/index";

import { fixturePath } from "./runtime-test-fixtures";
import { createTestScope } from "./scope-test-fixtures";

describe("Node host routing", () => {
  it("routes activation to the Node host and registers executable commands", async () => {
    const module = await import(
      new URL("./fixtures/runtime-plugin/index.mjs", import.meta.url).href
    );
    const commandRegistry = new RuntimeCommandRegistry();
    const hostRegistry = new PluginHostRegistry();
    const hostScope = createTestScope();
    const nodeHost = new NodePluginHost({ commandRegistry, scope: hostScope });

    module.calls.length = 0;
    hostRegistry.register(nodeHost);

    const host = hostRegistry.require("node", {
      pluginId: "dev.example.runtime",
    });

    await runRuntimeEffectPromise(
      host.activatePlugin({
        pluginId: "dev.example.runtime",
        entryPath: fixturePath("runtime-plugin/index.mjs"),
      }),
    );

    await expect(
      commandRegistry.run({
        commandId: "factory.echo",
        input: {
          text: "hello",
        },
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "hello",
        },
      ],
    });
    expect(module.calls).toEqual(["activate:dev.example.runtime"]);

    await runRuntimeEffectPromise(hostRegistry.disposeAll());

    expect(commandRegistry.has("factory.echo")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);
  });
});
