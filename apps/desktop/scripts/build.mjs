import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitePackageRoot = path.resolve(path.dirname(require.resolve("vite")), "../..");
const viteCliPath = path.join(vitePackageRoot, "bin", "vite.js");
const nuxtCliPath = path.join(
  path.dirname(require.resolve("nuxt/package.json")),
  "bin",
  "nuxt.mjs",
);

const buildTargets = [
  ["vite", "build", "--configLoader", "runner", "--config", "vite.main.config.ts"],
  ["vite", "build", "--configLoader", "runner", "--config", "vite.preload.config.ts"],
];

// Vite resolves the root tsconfig references before loading its config.
// Generate Nuxt's referenced configs first, including on a clean checkout.
await run("nuxt", ["prepare"]);

for (const [command, ...args] of buildTargets) {
  await run(command, args);
}

// Keep Electron's existing .vite/renderer/index.html packaging contract.
// Nuxt generates a CSR entry with relative assets and hash-based page navigation.
await run("nuxt", ["generate"], { ...process.env, NUXT_APP_BASE_URL: "./" });

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [command === "nuxt" ? nuxtCliPath : viteCliPath, ...args],
      {
        stdio: "inherit",
        cwd: appRoot,
        env,
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}
