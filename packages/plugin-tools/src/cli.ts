import { defineCommand } from "citty";

import { runGenerateCommandTypesCli } from "./generate-command-types-runner";
import {
  checkPluginProject,
  formatPluginCheckResult,
  formatPluginInspection,
  inspectPluginProject,
} from "./plugin-project";

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
      inspect: defineInspectCommand(),
    },
  });
}

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

export function defineCheckCommand() {
  return defineCommand({
    meta: {
      name: "check",
      description: "Check a Tooldeck plugin project.",
    },
    args: createCheckArgs(),
    async run({ rawArgs }) {
      const options = parseCheckArgs(rawArgs, "tooldeck-plugin check");
      const result = await checkPluginProject(options);

      console.log(formatPluginCheckResult(result));

      if (!result.ok) {
        process.exitCode = 1;
      }
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
      throw new Error(
        "tooldeck-plugin build is not implemented yet. Run tooldeck-plugin generate, your bundler, and tooldeck-plugin check --built.",
      );
    },
  });
}

export function defineInspectCommand() {
  return defineCommand({
    meta: {
      name: "inspect",
      description: "Inspect a Tooldeck plugin project.",
    },
    args: createInspectArgs(),
    async run({ rawArgs }) {
      const options = parseInspectArgs(rawArgs, "tooldeck-plugin inspect");
      const result = await inspectPluginProject(options);

      console.log(formatPluginInspection(result));
    },
  });
}

function createCheckArgs() {
  return {
    manifest: {
      type: "string",
      required: false,
      description: "Plugin manifest path.",
      valueHint: "manifest.json",
    },
    generated: {
      type: "string",
      required: false,
      description: "Generated command types path.",
      valueHint: "src/generated/commands.ts",
    },
    built: {
      type: "boolean",
      required: false,
      description: "Also check the built runtime entry.",
    },
  } as const;
}

function createInspectArgs() {
  return {
    manifest: {
      type: "string",
      required: false,
      description: "Plugin manifest path.",
      valueHint: "manifest.json",
    },
    generated: {
      type: "string",
      required: false,
      description: "Generated command types path.",
      valueHint: "src/generated/commands.ts",
    },
  } as const;
}

function parseCheckArgs(
  args: string[],
  commandName: string,
): { manifestPath?: string; generatedPath?: string; built?: boolean } {
  const parsed: { manifestPath?: string; generatedPath?: string; built?: boolean } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--built") {
      parsed.built = true;
      continue;
    }

    if (arg === "--manifest" || arg === "--generated") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}\nUsage: ${checkUsage(commandName)}`);
      }

      if (arg === "--manifest") {
        parsed.manifestPath = value;
      } else {
        parsed.generatedPath = value;
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      parsed.manifestPath = parseEqualsValue(arg, "--manifest", checkUsage(commandName));
      continue;
    }

    if (arg.startsWith("--generated=")) {
      parsed.generatedPath = parseEqualsValue(arg, "--generated", checkUsage(commandName));
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}\nUsage: ${checkUsage(commandName)}`);
  }

  return parsed;
}

function parseInspectArgs(
  args: string[],
  commandName: string,
): { manifestPath?: string; generatedPath?: string } {
  const parsed = parseCheckArgs(args, commandName);

  if (parsed.built) {
    throw new Error(`Unsupported argument: --built\nUsage: ${inspectUsage(commandName)}`);
  }

  return {
    manifestPath: parsed.manifestPath,
    generatedPath: parsed.generatedPath,
  };
}

function parseEqualsValue(arg: string, name: string, usageText: string): string {
  const value = arg.slice(name.length + 1);

  if (!value) {
    throw new Error(`Missing value for ${name}\nUsage: ${usageText}`);
  }

  return value;
}

function checkUsage(commandName: string): string {
  return `${commandName} [--manifest manifest.json] [--generated src/generated/commands.ts] [--built]`;
}

function inspectUsage(commandName: string): string {
  return `${commandName} [--manifest manifest.json] [--generated src/generated/commands.ts]`;
}
