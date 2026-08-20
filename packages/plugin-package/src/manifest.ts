import { createTooldeckJsonSchemaEngine, type JsonSchemaError } from "@tooldeck/json-schema";
import { manifestV1Schema, type JsonObject } from "@tooldeck/protocol";

import { packageError } from "./errors.js";
import { assertSafePackagePath } from "./paths.js";
import type { TooldeckPackagePluginManifest } from "./types.js";
import { isRecord } from "./utils.js";

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

  const engine = createTooldeckJsonSchemaEngine();
  const manifestCompilation = engine.compileDraft07<TooldeckPackagePluginManifest>(
    createPackageManifestSchema(),
  );

  if (!manifestCompilation.compiled) {
    throw formatManifestSchemaError(manifestCompilation.error, manifestPath);
  }

  const validation = manifestCompilation.validator.validate(value);

  if (!validation.valid) {
    throw formatManifestSchemaError(validation.error, manifestPath);
  }

  validateCommandSchemas(validation.value, manifestPath, engine);
  assertSafePackagePath(validation.value.runtime.entry, "runtime.entry");
  assertLocalePaths(validation.value, manifestPath);

  return validation.value;
}

function createPackageManifestSchema(): JsonObject {
  const schema = structuredClone(manifestV1Schema) as {
    definitions?: {
      runtime?: {
        properties?: {
          kind?: unknown;
        };
      };
      tooldeckInputJsonSchema?: boolean | object;
      tooldeckOutputJsonSchema?: boolean | object;
    };
  };

  if (schema.definitions?.runtime?.properties) {
    schema.definitions.runtime.properties.kind = {
      type: "string",
      minLength: 1,
    };
  }

  if (schema.definitions) {
    schema.definitions.tooldeckInputJsonSchema = true;
    schema.definitions.tooldeckOutputJsonSchema = true;
  }

  return schema as JsonObject;
}

function formatManifestSchemaError(
  error: JsonSchemaError,
  manifestPath: string,
  fieldPrefix?: string,
): ReturnType<typeof packageError> {
  const issue = error.issues[0];
  const message = issue?.message
    ? `Plugin manifest schema violation: ${issue.message}.`
    : "Plugin manifest does not match the protocol schema.";

  return packageError("INVALID_PLUGIN_MANIFEST", message, {
    manifestPath,
    fieldPath: issue ? joinFieldPath(fieldPrefix, issue.propertyPath || undefined) : fieldPrefix,
    reason: issue?.keyword,
  });
}

function joinFieldPath(base: string | undefined, property: string | undefined): string | undefined {
  if (!property) {
    return base;
  }

  return base ? `${base}${property.startsWith("[") ? "" : "."}${property}` : property;
}

function validateCommandSchemas(
  manifest: TooldeckPackagePluginManifest,
  manifestPath: string,
  engine: ReturnType<typeof createTooldeckJsonSchemaEngine>,
): void {
  for (const [index, command] of (manifest.contributes?.commands ?? []).entries()) {
    if (command.inputSchema !== undefined) {
      const compilation = engine.compileCommandInput(command.inputSchema, "strict");

      if (!compilation.compiled) {
        throw formatManifestSchemaError(
          compilation.error,
          manifestPath,
          `contributes.commands[${index}].inputSchema`,
        );
      }
    }

    if (command.outputSchema !== undefined) {
      const compilation = engine.compileCommandOutput(command.outputSchema);

      if (!compilation.compiled) {
        throw formatManifestSchemaError(
          compilation.error,
          manifestPath,
          `contributes.commands[${index}].outputSchema`,
        );
      }
    }
  }
}

function assertLocalePaths(value: TooldeckPackagePluginManifest, manifestPath: string): void {
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
