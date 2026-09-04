import { execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginsRoot = path.join(workspaceRoot, "plugins");
const packageManager = process.env.npm_execpath?.includes("pnpm")
  ? { args: [process.env.npm_execpath], command: process.execPath }
  : { args: [], command: "pnpm" };
const execFileAsync = promisify(execFile);

const [command, ...rawArgs] = process.argv.slice(2).filter((arg) => arg !== "--");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    switch (command) {
      case "list":
        await listCommand(rawArgs);
        break;
      case "build":
        await buildCommand(rawArgs);
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

  await runPnpm([
    "--dir",
    workspaceRoot,
    "exec",
    "turbo",
    "run",
    "build",
    ...plugins.map((plugin) => `--filter=${plugin.packageName}...`),
  ]);
}

async function stageCommand(args) {
  const outArgIndex = args.indexOf("--out");
  const mode = parseMode(args, "production");
  const skipBuild = args.includes("--skip-build");

  if (outArgIndex === -1 || !args[outArgIndex + 1]) {
    throw new Error("Missing required --out <dir> argument.");
  }

  const outputRoot = path.resolve(workspaceRoot, args[outArgIndex + 1]);
  assertSeparateDirectories(pluginsRoot, outputRoot);

  if (!skipBuild) {
    await buildCommand(["--mode", mode]);
  }

  const plugins = await stageBuiltinPlugins({ pluginsRoot, outputRoot, mode });

  console.log(
    `Staged ${plugins.length} builtin plugin${plugins.length === 1 ? "" : "s"} to ${path.relative(
      workspaceRoot,
      outputRoot,
    )}.`,
  );
}

export async function discoverBuiltinPlugins(root = pluginsRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pluginRoot = path.join(root, entry.name);
    const [manifest, packageJson] = await Promise.all([
      readRequiredJson(path.join(pluginRoot, "manifest.json")),
      readRequiredJson(path.join(pluginRoot, "package.json")),
    ]);

    if (typeof manifest?.id !== "string" || typeof packageJson?.name !== "string") {
      throw new Error(
        `Builtin plugin must declare manifest.id and package.json name: ${pluginRoot}`,
      );
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

async function readRequiredJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read builtin plugin metadata ${filePath}: ${error.message}`, {
      cause: error,
    });
  }
}

// Only the build/staging path loads package tooling. Listing remains a static scan,
// including on clean checkouts where the authoring packages have not been built yet.
export async function stageBuiltinPlugins({
  pluginsRoot: sourceRoot,
  outputRoot,
  mode = "production",
  temporaryRoot = tmpdir(),
}) {
  assertSeparateDirectories(sourceRoot, outputRoot);
  parseMode(["--mode", mode], "production");
  const plugins = filterPluginsByMode(await discoverBuiltinPlugins(sourceRoot), mode);
  const { packTooldeckPlugin, unpackTooldeckPackage } =
    await import("../packages/plugin-package/dist/index.js");
  const scratch = await mkdtemp(path.join(temporaryRoot, "tooldeck-builtin-package-"));
  try {
    const expandedRoot = path.join(scratch, "plugins");
    await mkdir(expandedRoot);
    for (const plugin of plugins) {
      try {
        const packagePath = path.join(scratch, `${plugin.directoryName}.tdplugin`);
        await packTooldeckPlugin({ projectDir: plugin.root, outputPath: packagePath });
        const destinationDir = path.join(expandedRoot, plugin.directoryName);
        const { pluginManifest } = await unpackTooldeckPackage({ packagePath, destinationDir });
        if (pluginManifest.runtime.kind !== "node") {
          throw new Error(
            `Unsupported builtin plugin runtime.kind: ${pluginManifest.runtime.kind}`,
          );
        }
        await checkStagedRuntime(destinationDir, pluginManifest.runtime.entry);
      } catch (error) {
        throw new Error(`Builtin plugin ${plugin.packageName}: ${error.message}`, { cause: error });
      }
    }
    await replaceStaging(expandedRoot, outputRoot);
    return plugins;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function checkStagedRuntime(pluginRoot, entry) {
  // Import in an isolated process outside the workspace so node_modules and the
  // source package.json cannot hide an incomplete package. Never call activate.
  const script = `
    import { pathToFileURL } from "node:url";
    const { default: plugin } = await import(pathToFileURL(process.argv[1]).href);
    if (!plugin || typeof plugin !== "object" || typeof plugin.activate !== "function") {
      throw new Error("Built default export must expose an activate(ctx) function.");
    }
  `;
  try {
    await execFileAsync(
      process.execPath,
      ["--input-type=module", "--eval", script, path.resolve(pluginRoot, entry)],
      { cwd: pluginRoot, timeout: 30_000, windowsHide: true },
    );
  } catch (error) {
    throw new Error(
      `Packaged runtime entry ${entry} is not loadable: ${error.stderr || error.message}`,
      { cause: error },
    );
  }
}

async function replaceStaging(source, destination) {
  const parent = path.dirname(destination);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".tooldeck-builtin-stage-"));
  const next = path.join(staging, "next");
  const previous = path.join(staging, "previous");
  let hasPrevious = false;
  let preserveBackup = false;
  try {
    await cp(source, next, { recursive: true });
    try {
      await rename(destination, previous);
      hasPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(next, destination);
    } catch (error) {
      if (hasPrevious) {
        try {
          await rename(previous, destination);
        } catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError(
            [error, restoreError],
            `Could not restore staging. Previous output retained at ${previous}`,
          );
        }
      }
      throw error;
    }
  } finally {
    if (preserveBackup) {
      await rm(next, { recursive: true, force: true });
    } else {
      await rm(staging, { recursive: true, force: true });
    }
  }
}

function assertSeparateDirectories(left, right) {
  const contains = (parent, child) => {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
  };
  if (contains(left, right) || contains(right, left)) {
    throw new Error(
      `Builtin plugin source and staging directories must not overlap: ${left}, ${right}`,
    );
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
