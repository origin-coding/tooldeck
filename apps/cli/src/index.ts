import path from "node:path";
import { fileURLToPath } from "node:url";

import { CommandRegistry, ManifestIndex, PluginManager } from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { scanPluginDirectory } from "./plugin-scanner";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function createPluginManager(options: { pluginsRoot: string }): Promise<{
  pluginManager: PluginManager;
  pluginHost: NodePluginHost;
}> {
  const commandRegistry = new CommandRegistry();
  const pluginHost = new NodePluginHost({ commandRegistry });
  const manifestIndex = new ManifestIndex();

  await scanPluginDirectory({
    pluginsRoot: options.pluginsRoot,
    manifestIndex,
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
        plugins: {
          type: "string",
          default: "./plugins",
          description: "Plugin directory to scan.",
          valueHint: "path",
        },
      },
      async run({ args }) {
        const pluginsRoot = path.resolve(workspaceRoot, args.plugins);
        const { pluginManager, pluginHost } = await createPluginManager({
          pluginsRoot,
        });

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
