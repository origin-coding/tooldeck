import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const publishPackages = [
  "packages/protocol",
  "packages/sdk-node",
  "packages/vite-plugin",
  "packages/plugin-tools",
  "packages/create-plugin",
  "apps/cli",
];

for (const packagePath of publishPackages) {
  const packageRoot = path.join(workspaceRoot, packagePath);
  const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const { name, version } = packageJson;
  const spec = `${name}@${version}`;

  if (await packageVersionExists(spec)) {
    console.log(`${spec} already exists on npm; skipping.`);
    continue;
  }

  const packDir = mkdtempSync(path.join(tmpdir(), "tooldeck-npm-pack-"));

  try {
    console.log(`Packing ${spec} from ${packagePath}.`);
    run(pnpmCommand(), ["pack", "--pack-destination", packDir], {
      cwd: packageRoot,
    });

    const tarball = findSingleTarball(packDir);
    const publishArgs = ["publish", tarball, "--access", "public", "--provenance"];

    if (dryRun) {
      publishArgs.push("--dry-run");
    }

    console.log(`${dryRun ? "Dry-running publish" : "Publishing"} ${spec}.`);
    run(npmCommand(), publishArgs, {
      cwd: packageRoot,
    });
  } finally {
    rmSync(packDir, { recursive: true, force: true });
  }
}

async function packageVersionExists(spec) {
  const command = createCommand(npmCommand(), ["view", spec, "version"]);
  const result = spawnSync(command.file, command.args, {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (output.includes("E404") || output.includes("404 Not Found")) {
    return false;
  }

  throw new Error(`Failed to check ${spec} on npm.\n${output.trim()}`);
}

function findSingleTarball(packDir) {
  const tarballs = readdirSync(packDir)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => path.join(packDir, entry));

  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed tarball in ${packDir}, found ${tarballs.length}.`);
  }

  return tarballs[0];
}

function run(command, args, options) {
  const spawnCommand = createCommand(command, args);
  const result = spawnSync(spawnCommand.file, spawnCommand.args, {
    ...options,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}

function npmCommand() {
  return "npm";
}

function pnpmCommand() {
  return "pnpm";
}

function createCommand(command, args) {
  if (process.platform !== "win32") {
    return { file: command, args };
  }

  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")],
  };
}

function quoteWindowsArg(arg) {
  const value = String(arg);

  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}
