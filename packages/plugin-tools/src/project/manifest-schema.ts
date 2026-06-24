import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import type { PluginManifest } from "@tooldeck/protocol";
import Ajv from "ajv";

import { formatUnknownError, normalizeAjvErrors } from "./diagnostics";
import type { PluginProjectDiagnostic } from "./types";

const require = createRequire(import.meta.url);
const manifestSchema = JSON.parse(
  readFileSync(require.resolve("@tooldeck/protocol/schema/manifest-v1.schema.json"), "utf8"),
) as object;

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
    });

    return undefined;
  }

  if (!validateManifestSchema(manifest)) {
    diagnostics.push(
      ...normalizeAjvErrors(validateManifestSchema.errors ?? []).map((error) => ({
        severity: "error" as const,
        code: "MANIFEST_SCHEMA",
        message: `${error.path} ${error.message}`,
        path: manifestPath,
      })),
    );

    return undefined;
  }

  return manifest;
}

function createRuntimeManifestSchema(): object {
  const schema = structuredClone(manifestSchema) as {
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
