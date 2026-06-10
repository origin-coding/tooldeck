import { defineCommand } from "citty";
import type { CommandDef } from "citty";

import { defineListCommand, defineRunCommand } from "./commands";
import { definePathsCommand } from "./paths";
import { definePluginCommand } from "./plugins";
import { definePreferenceCommand } from "./preferences";
import type { CreateCliCommandOptions } from "./runtime";

export * from "./commands";
export * from "./paths";
export * from "./plugins";
export * from "./preferences";
export * from "./runtime";

export function createCliCommand(options: CreateCliCommandOptions): CommandDef {
  return defineCommand({
    meta: {
      name: "tooldeck",
      description: "Command-line interface for Tooldeck.",
    },
    subCommands: {
      list: defineListCommand(options),
      run: defineRunCommand(options),
      plugin: definePluginCommand(options),
      preference: definePreferenceCommand(options),
      paths: definePathsCommand(options),
    },
  });
}
