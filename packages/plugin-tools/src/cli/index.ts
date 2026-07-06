import { defineCommand } from "citty";

import { defineBuildCommand } from "./build";
import { defineCheckCommand } from "./check";
import { defineGenerateCommand, defineGenerateTypesCommand } from "./generate";
import { defineInspectCommand } from "./inspect";
import { defineDistCommand, definePackCommand } from "./pack";

export function createPluginToolsCommand() {
  return defineCommand({
    meta: {
      name: "tooldeck-plugin",
      description: "Development tools for Tooldeck plugins.",
    },
    subCommands: {
      generate: defineGenerateCommand(),
      check: defineCheckCommand(),
      build: defineBuildCommand(),
      pack: definePackCommand(),
      dist: defineDistCommand(),
      inspect: defineInspectCommand(),
    },
  });
}

export {
  defineBuildCommand,
  defineCheckCommand,
  defineDistCommand,
  defineGenerateCommand,
  defineGenerateTypesCommand,
  defineInspectCommand,
  definePackCommand,
};
