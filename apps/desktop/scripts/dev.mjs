import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const waitOn = require("wait-on");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(appRoot, "../..");
const builtinPluginsRoot = path.join(appRoot, ".vite", "builtin-plugins");
const builtinPluginsScript = path.join(workspaceRoot, "scripts", "builtin-plugins.mjs");
const vitePackageRoot = path.resolve(path.dirname(require.resolve("vite")), "../..");
const viteCliPath = path.join(vitePackageRoot, "bin", "vite.js");
const electronPath = require("electron");
const electronArgs = process.argv.slice(2);

const children = new Map();
let shuttingDown = false;

log("dev", "Starting renderer, main, and preload watchers...");

await runProcess("builtin-plugins", process.execPath, [
  builtinPluginsScript,
  "stage",
  "--out",
  builtinPluginsRoot,
  "--mode",
  "development",
]);

startVite("renderer", ["--configLoader", "runner", "--config", "vite.renderer.config.ts"]);
startVite("main", [
  "build",
  "--watch",
  "--configLoader",
  "runner",
  "--config",
  "vite.main.config.ts",
]);
startVite("preload", [
  "build",
  "--watch",
  "--configLoader",
  "runner",
  "--config",
  "vite.preload.config.ts",
]);

process.once("SIGINT", () => void shutdown(130));
process.once("SIGTERM", () => void shutdown(143));

try {
  log("dev", "Waiting for renderer and Electron bundles...");

  await waitOn({
    resources: [
      "http-get://localhost:5173",
      path.join(appRoot, ".vite", "build", "main.js"),
      path.join(appRoot, ".vite", "build", "preload.cjs"),
    ],
    timeout: 60_000,
  });

  log("dev", "Starting Electron...");

  const electron = spawnProcess("electron", electronPath, [".", ...electronArgs], {
    env: {
      ...process.env,
      TOOLDECK_PLUGINS_ROOT: builtinPluginsRoot,
      TOOLDECK_RENDERER_URL: "http://localhost:5173",
    },
    windowsHide: false,
  });

  const code = await waitForExit(electron);
  log("electron", `exited with code ${code ?? 0}`);
  await shutdown(code ?? 0);
} catch (error) {
  log("dev", error instanceof Error ? error.message : String(error));
  await shutdown(1);
}

function startVite(name, args) {
  return spawnProcess(name, process.execPath, [viteCliPath, ...args]);
}

function runProcess(name, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...options,
    });

    pipeOutput(name, child.stdout);
    pipeOutput(name, child.stderr);

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${name} exited with code ${code ?? "unknown"}`));
    });
  });
}

function spawnProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: appRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });

  children.set(name, child);
  pipeOutput(name, child.stdout);
  pipeOutput(name, child.stderr);

  child.once("exit", (code, signal) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    if (name === "electron") {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    void shutdown(1, `${name} exited unexpectedly with ${reason}`);
  });

  child.once("error", (error) => {
    children.delete(name);

    if (!shuttingDown) {
      void shutdown(1, `${name} failed to start: ${error.message}`);
    }
  });

  return child;
}

async function shutdown(exitCode, reason) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (reason) {
    log("dev", reason);
  }

  const exits = [];

  for (const [name, child] of children) {
    if (child.exitCode !== null || child.signalCode !== null) {
      children.delete(name);
      continue;
    }

    exits.push(waitForExit(child));
    child.kill();
  }

  if (exits.length > 0) {
    await Promise.race([
      Promise.allSettled(exits),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }

  process.exit(exitCode);
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code) => resolve(code));
  });
}

function pipeOutput(name, stream) {
  let pending = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        log(name, line);
      }
    }
  });

  stream.on("end", () => {
    if (pending.length > 0) {
      log(name, pending);
    }
  });
}

function log(name, message) {
  console.log(`[${name}] ${message}`);
}
