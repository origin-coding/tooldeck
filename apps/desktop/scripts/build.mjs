import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const vitePackageRoot = path.resolve(path.dirname(require.resolve("vite")), "../..");
const viteCliPath = path.join(vitePackageRoot, "bin", "vite.js");

const buildTargets = [
  ["vite", "build", "--configLoader", "runner", "--config", "vite.main.config.ts"],
  ["vite", "build", "--configLoader", "runner", "--config", "vite.preload.config.ts"],
  ["vite", "build", "--configLoader", "runner", "--config", "vite.renderer.config.ts"],
];

for (const [command, ...args] of buildTargets) {
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteCliPath, ...args], {
      stdio: "inherit",
    });

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
