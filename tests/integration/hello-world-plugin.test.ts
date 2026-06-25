import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeCommandRegistry, ManifestIndex, PluginManager } from "@tooldeck/runtime-node";
import { NodePluginHost } from "@tooldeck/host-node";
import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function readManifest(manifestPath: string): Promise<PluginManifest> {
  const text = await readFile(manifestPath, "utf8");

  return JSON.parse(text) as PluginManifest;
}

describe("hello-world plugin integration", () => {
  it("runs hello.world through manifest indexing, lazy activation, and node hosting", async () => {
    const manifestPath = path.join(workspaceRoot, "plugins/hello-world/manifest.json");
    const manifest = await readManifest(manifestPath);
    const entryPath = path.resolve(path.dirname(manifestPath), manifest.runtime.entry);

    const commandRegistry = new RuntimeCommandRegistry();
    const manifestIndex = new ManifestIndex();
    const pluginHost = new NodePluginHost({ commandRegistry });

    manifestIndex.addPluginManifest({
      manifest,
      manifestPath,
      entryPath,
    });

    const pluginManager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    await expect(pluginManager.runCommand({ commandId: "hello.world" })).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "Hello, world!",
        },
      ],
    });

    expect(pluginHost.hasPlugin("dev.tooldeck.hello-world")).toBe(true);
    expect(commandRegistry.has("hello.world")).toBe(true);

    await pluginHost.disposeAll();

    expect(pluginHost.hasPlugin("dev.tooldeck.hello-world")).toBe(false);
    expect(commandRegistry.has("hello.world")).toBe(false);
  });
});
