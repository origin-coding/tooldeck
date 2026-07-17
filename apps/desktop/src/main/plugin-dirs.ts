import path from "node:path";

export interface ResolveDesktopPluginDirsOptions {
  argv?: string[];
  baseDir?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveDesktopPluginDirs(options: ResolveDesktopPluginDirsOptions = {}): string[] {
  const env = options.env ?? process.env;
  const baseDir = options.baseDir ?? env.INIT_CWD ?? process.cwd();
  const argvPluginDirs = parsePluginDirArgs(options.argv ?? process.argv);
  const envPluginDirs = parsePluginDirsEnv(env.TOOLDECK_PLUGIN_DIRS);

  return [...argvPluginDirs, ...envPluginDirs].map((pluginDir) =>
    path.isAbsolute(pluginDir) ? pluginDir : path.resolve(baseDir, pluginDir),
  );
}

export function parsePluginDirArgs(argv: string[]): string[] {
  const pluginDirs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--plugin-dir") {
      const value = argv[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --plugin-dir.");
      }

      pluginDirs.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--plugin-dir=")) {
      const value = arg.slice("--plugin-dir=".length);

      if (!value) {
        throw new Error("Missing value for --plugin-dir.");
      }

      pluginDirs.push(value);
    }
  }

  return pluginDirs;
}

export function parsePluginDirsEnv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(path.delimiter).filter((entry) => entry.length > 0);
}
