import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ErrorObject } from "ajv";

import type { PluginProjectDiagnostic } from "./types";

export type JsonRecord = Record<string, unknown>;

export function hasErrorDiagnostics(diagnostics: PluginProjectDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function normalizeAjvErrors(errors: ErrorObject[]): {
  fieldPath: string;
  message: string;
  suggestion: string;
}[] {
  return errors.map((error) => {
    const fieldPath = getAjvFieldPath(error);

    return {
      fieldPath,
      message: getAjvMessage(error, fieldPath),
      suggestion: getAjvSuggestion(error, fieldPath),
    };
  });
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

function getAjvFieldPath(error: ErrorObject): string {
  const basePath = jsonPointerToFieldPath(error.instancePath);

  if (error.keyword === "required") {
    const missingProperty = readStringParam(error, "missingProperty");

    return appendFieldPath(basePath, missingProperty);
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = readStringParam(error, "additionalProperty");

    return appendFieldPath(basePath, additionalProperty);
  }

  return basePath || "<root>";
}

function getAjvMessage(error: ErrorObject, fieldPath: string): string {
  if (error.keyword === "required") {
    return `${fieldPath} is required.`;
  }

  if (error.keyword === "additionalProperties") {
    return `${fieldPath} is not supported by the Tooldeck manifest schema.`;
  }

  if (error.keyword === "type") {
    const expectedType = readStringParam(error, "type") ?? "the expected type";

    return `${fieldPath} must be ${expectedType}.`;
  }

  if (error.keyword === "enum") {
    return `${fieldPath} must be one of the allowed values.`;
  }

  if (error.keyword === "const") {
    return `${fieldPath} must match the required value.`;
  }

  return `${fieldPath} ${error.message ?? "failed validation"}.`;
}

function getAjvSuggestion(error: ErrorObject, fieldPath: string): string {
  if (error.keyword === "required") {
    return getRequiredFieldSuggestion(fieldPath);
  }

  if (error.keyword === "additionalProperties") {
    return `Remove ${fieldPath} from manifest.json, or move it under a supported Tooldeck manifest field.`;
  }

  if (error.keyword === "type") {
    const expectedType = readStringParam(error, "type");

    return expectedType
      ? `Change ${fieldPath} to a JSON ${expectedType} value.`
      : `Change ${fieldPath} to the type required by the manifest schema.`;
  }

  if (error.keyword === "enum" || error.keyword === "const") {
    return `Use a value for ${fieldPath} that is allowed by the manifest schema.`;
  }

  return `Update ${fieldPath} so it matches the Tooldeck manifest schema.`;
}

function getRequiredFieldSuggestion(fieldPath: string): string {
  if (fieldPath === "schemaVersion") {
    return 'Add "schemaVersion": "1.0" to manifest.json.';
  }

  if (fieldPath === "id") {
    return 'Add a stable plugin id, for example "id": "dev.example.my-plugin".';
  }

  if (fieldPath === "name") {
    return 'Add a plugin name, for example "name": { "key": "plugin.name", "default": "My Plugin" }.';
  }

  if (fieldPath === "version") {
    return 'Add a package-style version, for example "version": "0.1.0".';
  }

  if (fieldPath === "runtime") {
    return 'Add "runtime": { "kind": "node", "entry": "./dist/index.js" }.';
  }

  if (fieldPath === "runtime.kind") {
    return 'Add "runtime.kind": "node".';
  }

  if (fieldPath === "runtime.entry") {
    return 'Add "runtime.entry": "./dist/index.js".';
  }

  return `Add ${fieldPath} to manifest.json.`;
}

function jsonPointerToFieldPath(pointer: string): string {
  if (!pointer) {
    return "";
  }

  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce(
      (fieldPath, part) =>
        /^\d+$/.test(part) ? `${fieldPath}[${part}]` : appendFieldPath(fieldPath, part),
      "",
    );
}

function appendFieldPath(basePath: string, fieldName: string | undefined): string {
  if (!fieldName) {
    return basePath || "<root>";
  }

  return basePath ? `${basePath}.${fieldName}` : fieldName;
}

function readStringParam(error: ErrorObject, key: string): string | undefined {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
}
