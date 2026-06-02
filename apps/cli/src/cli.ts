import path from "node:path";

import { CommandRegistry, ManifestIndex, PluginManager } from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import type { CommandResult } from "@tooldeck/protocol";
import { defineCommand } from "citty";
import type { CommandDef } from "citty";
import { consola } from "consola";
import { scanPluginDirectory } from "./plugin-scanner";

export interface CreateCliCommandOptions {
  workspaceRoot: string;
}

export interface CreatePluginManagerOptions {
  pluginsRoot: string;
}

export interface CreatedPluginManager {
  pluginManager: PluginManager;
  pluginHost: NodePluginHost;
  pluginCount: number;
  commandCount: number;
}

export async function createPluginManager(
  options: CreatePluginManagerOptions,
): Promise<CreatedPluginManager> {
  const commandRegistry = new CommandRegistry();
  const pluginHost = new NodePluginHost({ commandRegistry });
  const manifestIndex = new ManifestIndex();

  const scanResult = await scanPluginDirectory({
    pluginsRoot: options.pluginsRoot,
    manifestIndex,
  });

  return {
    pluginHost,
    pluginCount: scanResult.pluginCount,
    commandCount: scanResult.commandCount,
    pluginManager: new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    }),
  };
}

export function printTextBlocks(result: CommandResult): void {
  for (const block of result.blocks) {
    if (block.type === "text") {
      consola.log(block.text);
    }
  }
}

export function createCliCommand(options: CreateCliCommandOptions): CommandDef {
  return defineCommand({
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
          const pluginsRoot = path.resolve(options.workspaceRoot, args.plugins);
          const { pluginManager, pluginHost, pluginCount, commandCount } = await createPluginManager(
            {
              pluginsRoot,
            },
          );

          try {
            if (pluginCount === 0) {
              throw new Error(`No plugins found in directory: ${pluginsRoot}`);
            }

            if (commandCount === 0) {
              throw new Error(`No commands found in plugin directory: ${pluginsRoot}`);
            }

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
}
