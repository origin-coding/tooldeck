import { defineCommand } from "citty";

import { runGenerateCommandTypesCli } from "./generate-command-types-runner";

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
    },
  });
}

export function defineGenerateCommand() {
  return defineCommand({
    meta: {
      name: "generate",
      description: "Generate plugin project files.",
    },
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
    args: {
      manifest: {
        type: "positional",
        required: true,
        description: "Plugin manifest path.",
        valueHint: "manifest.json",
      },
      output: {
        type: "positional",
        required: true,
        description: "Generated TypeScript output path.",
        valueHint: "output.ts",
      },
    },
    async run({ args }) {
      await runGenerateCommandTypesCli([args.manifest, args.output], {
        commandName: "tooldeck-plugin generate types",
      });
    },
  });
}

export function defineCheckCommand() {
  return defineCommand({
    meta: {
      name: "check",
      description: "Check a Tooldeck plugin project.",
    },
    run() {
      console.log("tooldeck-plugin check is not implemented yet.");
    },
  });
}

export function defineBuildCommand() {
  return defineCommand({
    meta: {
      name: "build",
      description: "Build a Tooldeck plugin project.",
    },
    run() {
      console.log("tooldeck-plugin build is not implemented yet.");
    },
  });
}
