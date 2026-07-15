import { lstat, rm } from "node:fs/promises";

export async function tryLstat(filePath: string) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  return Boolean(await tryLstat(filePath));
}

export async function removePath(filePath: string): Promise<void> {
  await rm(filePath, { recursive: true, force: true });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
