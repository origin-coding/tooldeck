import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ErrorObject } from "ajv";

import type { PluginProjectDiagnostic } from "./types";

export type JsonRecord = Record<string, unknown>;

export function hasErrorDiagnostics(diagnostics: PluginProjectDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function normalizeAjvErrors(errors: ErrorObject[]): {
  path: string;
  message: string;
}[] {
  return errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
  }));
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readJsonIfExists(jsonPath: string): Promise<JsonRecord | undefined> {
  try {
    const text = await readFile(jsonPath, "utf8");
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
