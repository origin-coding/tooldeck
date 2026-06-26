export interface CreatePluginCliArgs {
  name?: string;
  pluginId?: string;
  pluginName?: string;
  commandId?: string;
  install?: boolean;
  yes?: boolean;
  template?: string;
}

export function parseCreatePluginArgs(args: string[]): CreatePluginCliArgs {
  const parsed: CreatePluginCliArgs = {};
  let positionalName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
      continue;
    }

    if (arg === "--install") {
      parsed.install = true;
      continue;
    }

    if (arg === "--no-install") {
      parsed.install = false;
      continue;
    }

    if (
      arg === "--name" ||
      arg === "--plugin-id" ||
      arg === "--plugin-name" ||
      arg === "--command-id" ||
      arg === "--template"
    ) {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}\nUsage: ${usage()}`);
      }

      assignValue(parsed, arg, value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      parsed.name = parseEqualsValue(arg, "--name");
      continue;
    }

    if (arg.startsWith("--plugin-id=")) {
      parsed.pluginId = parseEqualsValue(arg, "--plugin-id");
      continue;
    }

    if (arg.startsWith("--plugin-name=")) {
      parsed.pluginName = parseEqualsValue(arg, "--plugin-name");
      continue;
    }

    if (arg.startsWith("--command-id=")) {
      parsed.commandId = parseEqualsValue(arg, "--command-id");
      continue;
    }

    if (arg.startsWith("--template=")) {
      parsed.template = parseEqualsValue(arg, "--template");
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unsupported argument: ${arg}\nUsage: ${usage()}`);
    }

    if (positionalName) {
      throw new Error(`Only one plugin name can be provided.\nUsage: ${usage()}`);
    }

    positionalName = arg;
  }

  if (parsed.name && positionalName && parsed.name !== positionalName) {
    throw new Error("Plugin name was provided twice with different values.");
  }

  parsed.name ??= positionalName;

  return parsed;
}

function assignValue(parsed: CreatePluginCliArgs, arg: string, value: string): void {
  if (arg === "--name") {
    parsed.name = value;
  } else if (arg === "--plugin-id") {
    parsed.pluginId = value;
  } else if (arg === "--plugin-name") {
    parsed.pluginName = value;
  } else if (arg === "--command-id") {
    parsed.commandId = value;
  } else {
    parsed.template = value;
  }
}

function parseEqualsValue(arg: string, name: string): string {
  const value = arg.slice(name.length + 1);

  if (!value) {
    throw new Error(`Missing value for ${name}\nUsage: ${usage()}`);
  }

  return value;
}

function usage(): string {
  return "create-tooldeck-plugin <name> [--name name] [--plugin-id id] [--plugin-name name] [--command-id id] [--install|--no-install] [--yes]";
}
