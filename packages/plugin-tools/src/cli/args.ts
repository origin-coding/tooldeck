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
