import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import Ajv, { type ErrorObject } from "ajv";

import { packageError } from "./errors.js";
import { assertSafePackagePath } from "./paths.js";
import type { TooldeckPackagePluginManifest } from "./types.js";
import { isRecord } from "./utils.js";

const require = createRequire(import.meta.url);
const protocolManifestSchema = JSON.parse(
  readFileSync(require.resolve("@tooldeck/protocol/schema/manifest-v1.schema.json"), "utf8"),
) as Record<string, unknown>;
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});
const validatePackageManifestSchema = ajv.compile<TooldeckPackagePluginManifest>(
  createPackageManifestSchema(),
);

export function parsePluginManifestText(
  text: string,
  manifestPath: string,
): TooldeckPackagePluginManifest {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (error) {
    throw packageError("INVALID_PLUGIN_MANIFEST", "Plugin manifest is not valid JSON.", {
      manifestPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return validatePluginManifestShape(value, manifestPath);
}

export function validatePluginManifestShape(
  value: unknown,
  manifestPath: string,
): TooldeckPackagePluginManifest {
  if (!isRecord(value)) {
    throw packageError("INVALID_PLUGIN_MANIFEST", "Plugin manifest must be an object.", {
      manifestPath,
    });
  }

  if (!validatePackageManifestSchema(value)) {
    throw formatManifestSchemaError(validatePackageManifestSchema.errors ?? [], manifestPath);
  }

  assertSafePackagePath(value.runtime.entry, "runtime.entry");
  assertLocalePaths(value, manifestPath);

  return value;
}

function createPackageManifestSchema(): object {
  const schema = structuredClone(protocolManifestSchema) as {
    definitions?: {
      runtime?: {
        properties?: {
          kind?: unknown;
        };
      };
      tooldeckInputJsonSchema?: unknown;
      tooldeckJsonSchema?: unknown;
    };
  };

  if (schema.definitions?.runtime?.properties) {
    schema.definitions.runtime.properties.kind = {
      type: "string",
      minLength: 1,
    };
  }

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

function formatManifestSchemaError(
  errors: ErrorObject[],
  manifestPath: string,
): ReturnType<typeof packageError> {
  const error = errors[0];
  const message = error?.message
    ? `Plugin manifest schema violation: ${error.message}.`
    : "Plugin manifest does not match the protocol schema.";

  return packageError("INVALID_PLUGIN_MANIFEST", message, {
    manifestPath,
    fieldPath: error ? formatAjvFieldPath(error) : undefined,
    reason: error?.keyword,
  });
}

function formatAjvFieldPath(error: ErrorObject): string | undefined {
  const path = pointerToFieldPath(error.instancePath);

  if (error.keyword === "required") {
    const missingProperty = getStringParam(error.params, "missingProperty");
    return joinFieldPath(path, missingProperty);
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = getStringParam(error.params, "additionalProperty");
    return joinFieldPath(path, additionalProperty);
  }

  return path;
}

function pointerToFieldPath(pointer: string): string | undefined {
  if (!pointer) {
    return undefined;
  }

  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  return segments
    .map((segment, index) =>
      /^\d+$/.test(segment) ? `[${segment}]` : `${index === 0 ? "" : "."}${segment}`,
    )
    .join("");
}

function joinFieldPath(base: string | undefined, property: string | undefined): string | undefined {
  if (!property) {
    return base;
  }

  return base ? `${base}.${property}` : property;
}

function getStringParam(params: Record<string, unknown>, name: string): string | undefined {
  const value = params[name];

  return typeof value === "string" ? value : undefined;
}

function assertLocalePaths(value: Record<string, unknown>, manifestPath: string): void {
  if (value.locales === undefined) {
    return;
  }

  if (!isRecord(value.locales)) {
    throw packageError("INVALID_PLUGIN_MANIFEST", "Plugin manifest locales must be an object.", {
      manifestPath,
      fieldPath: "locales",
    });
  }

  for (const [locale, localePath] of Object.entries(value.locales)) {
    if (typeof localePath !== "string") {
      throw packageError("INVALID_PLUGIN_MANIFEST", "Plugin locale path must be a string.", {
        manifestPath,
        fieldPath: `locales.${locale}`,
      });
    }

    assertSafePackagePath(localePath, `locales.${locale}`);
  }
}
