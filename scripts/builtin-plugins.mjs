import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginsRoot = path.join(workspaceRoot, "plugins");
const packageManager = process.env.npm_execpath?.includes("pnpm")
  ? { args: [process.env.npm_execpath], command: process.execPath }
  : { args: [], command: "pnpm" };
const runtimeEntries = ["manifest.json", "package.json", "dist", "locales"];

const [command, ...rawArgs] = process.argv.slice(2).filter((arg) => arg !== "--");

try {
  switch (command) {
    case "list":
      await listCommand(rawArgs);
      break;
    case "build":
      await buildCommand();
      break;
    case "stage":
      await stageCommand(rawArgs);
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function listCommand(args) {
  const mode = parseMode(args, "development");
  const plugins = filterPluginsByMode(await discoverBuiltinPlugins(), mode);
  const json = args.includes("--json");

  if (json) {
    console.log(JSON.stringify(plugins, null, 2));
    return;
  }

  for (const plugin of plugins) {
    console.log(`${plugin.packageName} ${path.relative(workspaceRoot, plugin.root)}`);
  }
}

async function buildCommand(args = []) {
  const mode = parseMode(args, "development");
  const plugins = filterPluginsByMode(await discoverBuiltinPlugins(), mode);

  if (plugins.length === 0) {
    console.log("No builtin plugins found.");
    return;
  }

  for (const plugin of plugins) {
    await runPnpm(["--dir", workspaceRoot, "--filter", plugin.packageName, "build"]);
  }
}

async function stageCommand(args) {
  const outArgIndex = args.indexOf("--out");
  const mode = parseMode(args, "production");
  const skipBuild = args.includes("--skip-build");

  if (outArgIndex === -1 || !args[outArgIndex + 1]) {
    throw new Error("Missing required --out <dir> argument.");
  }

  if (!skipBuild) {
    await buildCommand(["--mode", mode]);
  }

  const outputRoot = path.resolve(workspaceRoot, args[outArgIndex + 1]);
  const plugins = filterPluginsByMode(await discoverBuiltinPlugins(), mode);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const plugin of plugins) {
    const outputPluginRoot = path.join(outputRoot, plugin.directoryName);

    await mkdir(outputPluginRoot, { recursive: true });

    for (const entry of runtimeEntries) {
      await copyIfExists(path.join(plugin.root, entry), path.join(outputPluginRoot, entry));
    }
  }

  console.log(
    `Staged ${plugins.length} builtin plugin${plugins.length === 1 ? "" : "s"} to ${path.relative(
      workspaceRoot,
      outputRoot,
    )}.`,
  );
}

async function discoverBuiltinPlugins() {
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pluginRoot = path.join(pluginsRoot, entry.name);
    const [manifest, packageJson] = await Promise.all([
      readJsonIfExists(path.join(pluginRoot, "manifest.json")),
      readJsonIfExists(path.join(pluginRoot, "package.json")),
    ]);

    if (!manifest || !packageJson?.name) {
      continue;
    }

    plugins.push({
      directoryName: entry.name,
      id: manifest.id,
      includeInProduction: packageJson.tooldeck?.builtinPlugin?.includeInProduction !== false,
      packageName: packageJson.name,
      root: pluginRoot,
    });
  }

  return plugins.sort((left, right) => left.packageName.localeCompare(right.packageName));
}

function filterPluginsByMode(plugins, mode) {
  if (mode === "development") {
    return plugins;
  }

  return plugins.filter((plugin) => plugin.includeInProduction);
}

function parseMode(args, defaultMode) {
  const modeArgIndex = args.indexOf("--mode");
  const mode = modeArgIndex === -1 ? defaultMode : args[modeArgIndex + 1];

  if (mode !== "development" && mode !== "production") {
    throw new Error(`Unsupported builtin plugin mode: ${mode}`);
  }

  return mode;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function copyIfExists(from, to) {
  try {
    await cp(from, to, { recursive: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function runPnpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManager.command, [...packageManager.args, ...args], {
      cwd: workspaceRoot,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pnpm ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function printUsage() {
  console.error(`Usage:
  node scripts/builtin-plugins.mjs list [--json] [--mode development|production]
  node scripts/builtin-plugins.mjs build [--mode development|production]
  node scripts/builtin-plugins.mjs stage --out <dir> [--mode development|production] [--skip-build]`);
}
