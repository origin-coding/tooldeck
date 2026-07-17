import { readFile } from "node:fs/promises";
import path from "node:path";

import { manifestV1Schema, type PluginManifest } from "@tooldeck/protocol";
import Ajv from "ajv";

import { checkLocales } from "./locale";
import { checkSupportedSchemaExtensions } from "./schema-extensions";
import type { PluginProjectDiagnostic } from "./types";
import { formatUnknownError, normalizeAjvErrors } from "./utils";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const validateManifestSchema = ajv.compile<PluginManifest>(createRuntimeManifestSchema());

export async function readAndValidateManifest(
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<PluginManifest | undefined> {
  let text: string;

  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "MANIFEST_MISSING",
      message: `Manifest file does not exist or cannot be read: ${formatUnknownError(error)}`,
      path: manifestPath,
      suggestion: "Create a manifest.json file or pass the correct path with --manifest.",
    });

    return undefined;
  }

  let manifest: unknown;

  try {
    manifest = JSON.parse(text);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "MANIFEST_INVALID_JSON",
      message: `Manifest is not valid JSON: ${formatUnknownError(error)}`,
      path: manifestPath,
      suggestion: "Fix the JSON syntax in manifest.json and run tooldeck-plugin check again.",
    });

    return undefined;
  }

  if (!validateManifestSchema(manifest)) {
    diagnostics.push(
      ...normalizeAjvErrors(validateManifestSchema.errors ?? []).map((error) => ({
        severity: "error" as const,
        code: "MANIFEST_SCHEMA",
        message: error.message,
        path: manifestPath,
        fieldPath: error.fieldPath,
        suggestion: error.suggestion,
      })),
    );

    return undefined;
  }

  return manifest;
}

export async function checkManifestSemantics(
  manifest: PluginManifest,
  manifestPath: string,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  if (manifest.runtime.kind !== "node") {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_UNSUPPORTED",
      message: `Unsupported runtime kind: ${manifest.runtime.kind}`,
      path: manifestPath,
      fieldPath: "runtime.kind",
      suggestion: 'Set manifest.runtime.kind to "node".',
    });
  }

  if (path.isAbsolute(manifest.runtime.entry)) {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_ENTRY_ABSOLUTE",
      message: "manifest.runtime.entry must be relative to the manifest file.",
      path: manifestPath,
      fieldPath: "runtime.entry",
      suggestion: 'Use a relative built entry such as "./dist/index.js".',
    });
  }

  if (!manifest.runtime.entry.startsWith("./") && !manifest.runtime.entry.startsWith("../")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_RELATIVE_STYLE",
      message: "Prefer an explicit relative runtime entry such as ./dist/index.js.",
      path: manifestPath,
      fieldPath: "runtime.entry",
      suggestion: 'Prefix the runtime entry with "./", for example "./dist/index.js".',
    });
  }

  if (!normalizePath(manifest.runtime.entry).startsWith("dist/")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_DIST",
      message: "The recommended runtime entry points to a built file under ./dist.",
      path: manifestPath,
      fieldPath: "runtime.entry",
      suggestion: 'Point manifest.runtime.entry at the built output, usually "./dist/index.js".',
    });
  }

  checkUniqueCommandIds(manifest, manifestPath, diagnostics);
  checkSupportedSchemaExtensions(manifest, manifestPath, diagnostics);
  await checkLocales(manifest, manifestDir, diagnostics);
}

function checkUniqueCommandIds(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const seen = new Set<string>();

  for (const command of manifest.contributes?.commands ?? []) {
    if (seen.has(command.id)) {
      diagnostics.push({
        severity: "error",
        code: "COMMAND_ID_DUPLICATE",
        message: `Command id is duplicated in this manifest: ${command.id}`,
        path: manifestPath,
        fieldPath: "contributes.commands",
        suggestion: "Give each contributed command a unique id.",
      });
    }

    seen.add(command.id);
  }
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function createRuntimeManifestSchema(): object {
  const schema = structuredClone(manifestV1Schema) as {
    definitions?: {
      tooldeckInputJsonSchema?: unknown;
      tooldeckJsonSchema?: unknown;
    };
  };

  if (schema.definitions) {
    schema.definitions.tooldeckInputJsonSchema = {
      type: "object",
      description:
        "A command input JSON Schema object. Full JSON Schema validation is deferred to command input handling.",
    };
    schema.definitions.tooldeckJsonSchema = {
      type: "object",
      description:
        "A JSON Schema object. Full JSON Schema validation is deferred to command input handling.",
    };
  }

  return schema;
}
