import { defineCommand } from "citty";

import { runGenerateCommandTypesCli } from "../generate-command-types/runner";

export function defineGenerateCommand() {
  return defineCommand({
    meta: {
      name: "generate",
      description: "Generate plugin project files.",
    },
    args: createGenerateTypesArgs(),
    default: "types",
    subCommands: {
      types: defineGenerateTypesCommand(),
    },
  });
}

export function defineGenerateTypesCommand() {
  return defineCommand({
    meta: {
      name: "types",
      description: "Generate command input types from a plugin manifest.",
    },
    args: createGenerateTypesArgs(),
    async run({ rawArgs }) {
      await runGenerateCommandTypesCli(rawArgs, {
        commandName: "tooldeck-plugin generate types",
      });
    },
  });
}

function createGenerateTypesArgs() {
  return {
    manifest: {
      type: "string",
      required: false,
      description: "Plugin manifest path.",
      valueHint: "manifest.json",
    },
    out: {
      type: "string",
      required: false,
      description: "Generated TypeScript output path.",
      valueHint: "src/generated/commands.ts",
    },
  } as const;
}
