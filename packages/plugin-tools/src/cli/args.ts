export interface PluginProjectCommandArgs {
  manifestPath?: string;
  generatedPath?: string;
  built?: boolean;
}

export interface PluginProjectBuildArgs {
  manifestPath?: string;
  generatedPath?: string;
  bundler?: string;
}

export interface PluginProjectPackArgs {
  manifestPath?: string;
  generatedPath?: string;
  outputPath?: string;
}

export interface PluginProjectDistArgs extends PluginProjectPackArgs {
  bundler?: string;
}

export function createProjectCheckArgs() {
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

export function createProjectInspectArgs() {
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

export function createProjectBuildArgs() {
  return {
    bundler: {
      type: "string",
      required: false,
      description: 'Bundler to use. Only "vite" is supported.',
      valueHint: "vite",
    },
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

export function createProjectPackArgs() {
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
    output: {
      type: "string",
      required: false,
      description: "Output .tdplugin path.",
      valueHint: "plugin.tdplugin",
    },
  } as const;
}

export function createProjectDistArgs() {
  return {
    ...createProjectPackArgs(),
    bundler: {
      type: "string",
      required: false,
      description: 'Bundler to use. Defaults to "vite"; only "vite" is supported.',
      valueHint: "vite",
    },
  } as const;
}

export function parseProjectCheckArgs(
  args: string[],
  commandName: string,
): PluginProjectCommandArgs {
  const parsed: PluginProjectCommandArgs = {};

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

export function parseProjectInspectArgs(
  args: string[],
  commandName: string,
): Omit<PluginProjectCommandArgs, "built"> {
  const parsed = parseProjectCheckArgs(args, commandName);

  if (parsed.built) {
    throw new Error(`Unsupported argument: --built\nUsage: ${inspectUsage(commandName)}`);
  }

  return {
    manifestPath: parsed.manifestPath,
    generatedPath: parsed.generatedPath,
  };
}

export function parseProjectBuildArgs(
  args: string[],
  commandName: string,
): PluginProjectBuildArgs {
  const parsed: PluginProjectBuildArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--bundler" || arg === "--manifest" || arg === "--generated") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}\nUsage: ${buildUsage(commandName)}`);
      }

      if (arg === "--bundler") {
        parsed.bundler = value;
      } else if (arg === "--manifest") {
        parsed.manifestPath = value;
      } else {
        parsed.generatedPath = value;
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("--bundler=")) {
      parsed.bundler = parseEqualsValue(arg, "--bundler", buildUsage(commandName));
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      parsed.manifestPath = parseEqualsValue(arg, "--manifest", buildUsage(commandName));
      continue;
    }

    if (arg.startsWith("--generated=")) {
      parsed.generatedPath = parseEqualsValue(arg, "--generated", buildUsage(commandName));
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}\nUsage: ${buildUsage(commandName)}`);
  }

  return parsed;
}

export function parseProjectPackArgs(
  args: string[],
  commandName: string,
): PluginProjectPackArgs {
  const parsed: PluginProjectPackArgs = {};

  parseSharedPackArgs(args, commandName, parsed, packUsage(commandName));

  return parsed;
}

export function parseProjectDistArgs(
  args: string[],
  commandName: string,
): PluginProjectDistArgs {
  const parsed: PluginProjectDistArgs = {};
  const usage = distUsage(commandName);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--bundler") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}\nUsage: ${usage}`);
      }

      parsed.bundler = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--bundler=")) {
      parsed.bundler = parseEqualsValue(arg, "--bundler", usage);
      continue;
    }

    const consumed = parseSharedPackArg(args, index, parsed, usage);

    if (consumed > 0) {
      index += consumed - 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}\nUsage: ${usage}`);
  }

  return parsed;
}

function parseSharedPackArgs(
  args: string[],
  commandName: string,
  parsed: PluginProjectPackArgs,
  usage: string,
): void {
  for (let index = 0; index < args.length; index += 1) {
    const consumed = parseSharedPackArg(args, index, parsed, usage);

    if (consumed > 0) {
      index += consumed - 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${args[index]}\nUsage: ${usage}`);
  }
}

function parseSharedPackArg(
  args: string[],
  index: number,
  parsed: PluginProjectPackArgs,
  usage: string,
): number {
  const arg = args[index];

  if (arg === "--manifest" || arg === "--generated" || arg === "--output") {
    const value = args[index + 1];

    if (!value || value.startsWith("-")) {
      throw new Error(`Missing value for ${arg}\nUsage: ${usage}`);
    }

    setSharedPackArg(parsed, arg, value);

    return 2;
  }

  if (arg.startsWith("--manifest=")) {
    parsed.manifestPath = parseEqualsValue(arg, "--manifest", usage);
    return 1;
  }

  if (arg.startsWith("--generated=")) {
    parsed.generatedPath = parseEqualsValue(arg, "--generated", usage);
    return 1;
  }

  if (arg.startsWith("--output=")) {
    parsed.outputPath = parseEqualsValue(arg, "--output", usage);
    return 1;
  }

  return 0;
}

function setSharedPackArg(parsed: PluginProjectPackArgs, arg: string, value: string): void {
  if (arg === "--manifest") {
    parsed.manifestPath = value;
  } else if (arg === "--generated") {
    parsed.generatedPath = value;
  } else {
    parsed.outputPath = value;
  }
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

function buildUsage(commandName: string): string {
  return `${commandName} --bundler vite [--manifest manifest.json] [--generated src/generated/commands.ts]`;
}

function packUsage(commandName: string): string {
  return `${commandName} [--manifest manifest.json] [--generated src/generated/commands.ts] [--output plugin.tdplugin]`;
}

function distUsage(commandName: string): string {
  return `${commandName} [--bundler vite] [--manifest manifest.json] [--generated src/generated/commands.ts] [--output plugin.tdplugin]`;
}
