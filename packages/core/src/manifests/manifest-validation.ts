import type { PluginManifest } from "@tooldeck/protocol";
import manifestSchema from "@tooldeck/protocol/schema/manifest-v1.schema.json";
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
      message: formatManifestErrorMessage(
        "Plugin manifest is not valid JSON",
        options.manifestPath,
      ),
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
    validatePluginManifestSemantics(options.manifest, options.manifestPath);

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

function validatePluginManifestSemantics(
  manifest: PluginManifest,
  manifestPath: string | undefined,
): void {
  const errors: { path: string; message: string; keyword: string }[] = [];
  const commands = manifest.contributes?.commands ?? [];

  commands.forEach((command, commandIndex) => {
    const inputSchema = command.inputSchema;

    if (!isRecord(inputSchema)) {
      return;
    }

    if (!("x-ui" in inputSchema)) {
      return;
    }

    const uiPath = `/contributes/commands/${commandIndex}/inputSchema/x-ui`;
    const fieldOrderPath = `/contributes/commands/${commandIndex}/inputSchema/x-ui/fieldOrder`;
    const ui = inputSchema["x-ui"];

    if (!isRecord(ui)) {
      errors.push({
        path: uiPath,
        message: "must be an object",
        keyword: "x-ui",
      });

      return;
    }

    for (const key of Object.keys(ui)) {
      if (key !== "fieldOrder") {
        errors.push({
          path: `${uiPath}/${key}`,
          message: "is not a supported input schema x-ui property",
          keyword: "x-ui",
        });
      }
    }

    const fieldOrder = ui.fieldOrder;

    if (fieldOrder === undefined) {
      return;
    }

    if (!Array.isArray(fieldOrder)) {
      errors.push({
        path: fieldOrderPath,
        message: "must be an array of input field names",
        keyword: "x-ui.fieldOrder",
      });

      return;
    }

    const properties = isRecord(inputSchema.properties) ? inputSchema.properties : {};
    const propertyKeys = new Set(Object.keys(properties));
    const seen = new Set<string>();

    fieldOrder.forEach((fieldName, fieldIndex) => {
      const itemPath = `${fieldOrderPath}/${fieldIndex}`;

      if (typeof fieldName !== "string" || fieldName.length === 0) {
        errors.push({
          path: itemPath,
          message: "must be a non-empty input field name",
          keyword: "x-ui.fieldOrder",
        });

        return;
      }

      if (seen.has(fieldName)) {
        errors.push({
          path: itemPath,
          message: `duplicates input field '${fieldName}'`,
          keyword: "x-ui.fieldOrder",
        });

        return;
      }

      seen.add(fieldName);

      if (!propertyKeys.has(fieldName)) {
        errors.push({
          path: itemPath,
          message: `references unknown input field '${fieldName}'`,
          keyword: "x-ui.fieldOrder",
        });
      }
    });
  });

  commands.forEach((command, commandIndex) => {
    const outputSchema = command.outputSchema;

    if (isRecord(outputSchema) && "x-ui" in outputSchema) {
      errors.push({
        path: `/contributes/commands/${commandIndex}/outputSchema/x-ui`,
        message: "is not supported on command output schemas",
        keyword: "x-ui",
      });
    }
  });

  if (errors.length === 0) {
    return;
  }

  const firstError = errors[0]!;
  const reason = `${firstError.path} ${firstError.message}`;

  throw new TooldeckError({
    code: "ERR_INVALID_ARGUMENT",
    message: formatManifestErrorMessage(`Invalid plugin manifest: ${reason}`, manifestPath),
    details: {
      manifestPath: manifestPath ?? null,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
