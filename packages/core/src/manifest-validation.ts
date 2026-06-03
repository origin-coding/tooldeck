import manifestSchema from "@tooldeck/protocol/schema/manifest-v1.schema.json";
import type { PluginManifest } from "@tooldeck/protocol";
import { TooldeckError } from "@tooldeck/shared";
import Ajv, { type ErrorObject } from "ajv";

export interface ParsePluginManifestTextOptions {
  text: string;
  manifestPath?: string;
}

export interface ValidatePluginManifestOptions {
  manifest: unknown;
  manifestPath?: string;
}

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const validateManifest = ajv.compile<PluginManifest>(createRuntimeManifestSchema());

export function parsePluginManifestText(options: ParsePluginManifestTextOptions): PluginManifest {
  let manifest: unknown;

  try {
    manifest = JSON.parse(options.text);
  } catch (error) {
    throw new TooldeckError({
      code: "ERR_INVALID_ARGUMENT",
      message: formatManifestErrorMessage("Plugin manifest is not valid JSON", options.manifestPath),
      cause: error,
      details: {
        manifestPath: options.manifestPath ?? null,
      },
    });
  }

  return validatePluginManifest({
    manifest,
    manifestPath: options.manifestPath,
  });
}

export function validatePluginManifest(options: ValidatePluginManifestOptions): PluginManifest {
  if (validateManifest(options.manifest)) {
    return options.manifest;
  }

  const errors = normalizeAjvErrors(validateManifest.errors ?? []);
  const firstError = errors[0];
  const reason = firstError
    ? `${firstError.path || "/"} ${firstError.message}`
    : "unknown validation error";

  throw new TooldeckError({
    code: "ERR_INVALID_ARGUMENT",
    message: formatManifestErrorMessage(`Invalid plugin manifest: ${reason}`, options.manifestPath),
    details: {
      manifestPath: options.manifestPath ?? null,
      errors,
    },
  });
}

function normalizeAjvErrors(errors: ErrorObject[]): {
  path: string;
  message: string;
  keyword: string;
}[] {
  return errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
    keyword: error.keyword,
  }));
}

function formatManifestErrorMessage(message: string, manifestPath: string | undefined): string {
  if (!manifestPath) {
    return message;
  }

  return `${message}: ${manifestPath}`;
}

function createRuntimeManifestSchema(): object {
  const schema = structuredClone(manifestSchema) as {
    definitions?: {
      tooldeckJsonSchema?: unknown;
    };
  };

  if (schema.definitions) {
    schema.definitions.tooldeckJsonSchema = {
      type: "object",
      description: "A JSON Schema object. Full JSON Schema validation is deferred to command input handling.",
    };
  }

  return schema;
}
