import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProcessSupervisor } from "./dev-processes.mjs";
import { waitForFile, waitForHttp } from "./readiness.mjs";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");
const builtinPluginsRoot = path.join(appRoot, ".vite", "builtin-plugins");
const vitePackageRoot = path.resolve(path.dirname(require.resolve("vite")), "../..");
const viteCliPath = path.join(vitePackageRoot, "bin", "vite.js");
const electronPath = require("electron");
const rendererUrl = "http://localhost:5173";
const bundles = ["main.js", "preload.cjs"].map((name) =>
  path.join(appRoot, ".vite", "build", name),
);
const supervisor = createProcessSupervisor({ cwd: appRoot, log });
let exitCode = 0;

// Register before preparation: it also owns pnpm/build descendants.
const onInterrupt = () => stop(130, "Received SIGINT");
const onTerminate = () => stop(143, "Received SIGTERM");
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);

try {
  log("dev", "Preparing builtin plugins...");
  const preparation = supervisor.start(
    "builtin-plugins",
    process.execPath,
    [
      path.join(workspaceRoot, "scripts", "builtin-plugins.mjs"),
      "stage",
      "--out",
      builtinPluginsRoot,
      "--mode",
      "development",
    ],
    { required: false },
  );
  const prepared = await preparation.completed;
  supervisor.signal.throwIfAborted();
  if (prepared.code !== 0) {
    throw new Error(`builtin-plugins exited with ${prepared.signal ?? prepared.code}`);
  }

  // A previous session's bundles must not satisfy this session's readiness.
  for (const bundle of bundles) {
    await unlink(bundle).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    supervisor.signal.throwIfAborted();
  }

  log("dev", "Starting renderer, main, and preload watchers...");
  startVite("renderer", [
    "--host",
    "localhost",
    "--port",
    "5173",
    "--strictPort",
    "--configLoader",
    "runner",
    "--config",
    "vite.renderer.config.ts",
  ]);
  for (const name of ["main", "preload"]) {
    startVite(name, [
      "build",
      "--watch",
      "--configLoader",
      "runner",
      "--config",
      `vite.${name}.config.ts`,
    ]);
  }

  log("dev", "Waiting for renderer and Electron bundles...");
  const options = { timeoutMs: 60_000, signal: supervisor.signal };
  await Promise.all([
    waitForHttp(rendererUrl, options),
    ...bundles.map((bundle) => waitForFile(bundle, options)),
  ]);
  supervisor.signal.throwIfAborted();

  log("dev", "Starting Electron...");
  const electron = supervisor.start("electron", electronPath, [".", ...process.argv.slice(2)], {
    required: false,
    env: {
      ...process.env,
      TOOLDECK_PLUGINS_ROOT: builtinPluginsRoot,
      TOOLDECK_RENDERER_URL: rendererUrl,
    },
    windowsHide: false,
  });
  const result = await electron.completed;
  supervisor.signal.throwIfAborted();
  exitCode = result.code ?? 1;
  log("electron", `exited with ${result.signal ?? `code ${exitCode}`}`);
} catch (error) {
  if (exitCode === 0) exitCode = 1;
  log("dev", error instanceof Error ? error.message : String(error));
} finally {
  try {
    await supervisor.shutdown();
  } catch (error) {
    if (exitCode === 0) exitCode = 1;
    log("dev", `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
  process.exitCode = exitCode;
}

function startVite(name, args) {
  return supervisor.start(name, process.execPath, [viteCliPath, ...args]);
}

function stop(code, message) {
  exitCode = code;
  supervisor.abort(new Error(message));
}

function log(name, message) {
  console.log(`[${name}] ${message}`);
}
