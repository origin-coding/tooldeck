import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CommandRegistry, ManifestIndex, PluginManager } from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import type { PluginManifest } from "@tooldeck/protocol";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readManifest(manifestPath: string): Promise<PluginManifest> {
  const text = await readFile(manifestPath, "utf8");

  return JSON.parse(text) as PluginManifest;
}

async function createPluginManager(): Promise<{
  pluginManager: PluginManager;
  pluginHost: NodePluginHost;
}> {
  const manifestPath = path.join(workspaceRoot, "plugins/hello-world/manifest.json");
  const manifest = await readManifest(manifestPath);
  const entryPath = path.resolve(path.dirname(manifestPath), manifest.runtime.entry);

  const commandRegistry = new CommandRegistry();
  const pluginHost = new NodePluginHost({ commandRegistry });
  const manifestIndex = new ManifestIndex();

  manifestIndex.addPluginManifest({
    manifest,
    manifestPath,
    entryPath,
  });

  return {
    pluginHost,
    pluginManager: new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    }),
  };
}

function printTextBlocks(result: Awaited<ReturnType<PluginManager["runCommand"]>>): void {
  for (const block of result.blocks) {
    if (block.type === "text") {
      consola.log(block.text);
    }
  }
}

const mainCommand = defineCommand({
  meta: {
    name: "tooldeck",
    description: "Command-line interface for Tooldeck.",
  },
  subCommands: {
    run: defineCommand({
      meta: {
        name: "run",
        description: "Run a Tooldeck command.",
      },
      args: {
        commandId: {
          type: "positional",
          required: true,
          description: "Command id to run.",
          valueHint: "command",
        },
      },
      async run({ args }) {
        const { pluginManager, pluginHost } = await createPluginManager();

        try {
          const result = await pluginManager.runCommand({
            commandId: args.commandId,
          });

          printTextBlocks(result);
        } finally {
          await pluginHost.disposeAll();
        }
      },
    }),
  },
});

await runMain(mainCommand).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  consola.error(message);
  process.exitCode = 1;
});
