import { access } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

export async function detectPackageManager(startDir: string): Promise<string | undefined> {
  let currentDir = startDir;

  while (true) {
    if (await pathExists(path.join(currentDir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }

    if (await pathExists(path.join(currentDir, "package-lock.json"))) {
      return "npm";
    }

    if (await pathExists(path.join(currentDir, "yarn.lock"))) {
      return "yarn";
    }

    if (
      (await pathExists(path.join(currentDir, "bun.lockb"))) ||
      (await pathExists(path.join(currentDir, "bun.lock")))
    ) {
      return "bun";
    }

    const parent = path.dirname(currentDir);

    if (parent === currentDir) {
      return undefined;
    }

    currentDir = parent;
  }
}
