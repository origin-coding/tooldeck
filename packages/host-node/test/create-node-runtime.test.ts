import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createNodeRuntime } from "../src";

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

describe("createNodeRuntime", () => {
  it("scans manifests, lazy activates commands, and disposes active plugins", async () => {
    const module = await import(
      new URL("./fixtures/runtime-plugin/index.mjs", import.meta.url).href
    );

    module.calls.length = 0;

    const afterScanCalls: Array<{ pluginCount: number; commandCount: number }> = [];
    const runtime = await createNodeRuntime({
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
    expect(runtime.pluginHost.hasPlugin("dev.example.runtime")).toBe(false);
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

    expect(runtime.pluginHost.hasPlugin("dev.example.runtime")).toBe(true);
    expect(module.calls).toEqual(["activate:dev.example.runtime"]);

    await runtime.dispose();

    expect(runtime.pluginHost.hasPlugin("dev.example.runtime")).toBe(false);
    expect(module.calls).toEqual([
      "activate:dev.example.runtime",
      "deactivate:dev.example.runtime",
      "dispose:dev.example.runtime",
    ]);
  });
});
