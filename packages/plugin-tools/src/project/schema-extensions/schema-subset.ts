import type { PluginProjectDiagnostic } from "../types";
import { type JsonRecord, isRecord } from "../utils";
import { inputSchemaFieldPath } from "./diagnostic-paths";

const supportedSchemaKeywords = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "allOf",
  "enum",
  "const",
  "default",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "title",
  "description",
  "examples",
  "readOnly",
  "writeOnly",
  "deprecated",
  "x-i18n",
  "x-ui",
  "x-enumLabels",
]);

const supportedSchemaTypes = new Set([
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null",
]);

export function checkInputSchemaSubset(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  schemaPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  for (const key of Object.keys(schema)) {
    if (!supportedSchemaKeywords.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
        message: `Command at index ${commandIndex} ${schemaPath} uses unsupported inputSchema keyword: ${key}`,
        path: manifestPath,
        fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, key),
        suggestion: `Remove ${key} from the command inputSchema or replace it with a supported JSON Schema keyword.`,
      });
    }
  }

  const type = schema.type;

  if (Array.isArray(type)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_UNSUPPORTED_TYPE",
      message: `Command at index ${commandIndex} ${schemaPath}.type must be a single supported type.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "type"),
      suggestion: "Use a single supported JSON Schema type instead of a type array.",
    });
  } else if (type !== undefined && !supportedSchemaTypes.has(String(type))) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_UNSUPPORTED_TYPE",
      message: `Command at index ${commandIndex} ${schemaPath}.type is unsupported: ${String(type)}`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "type"),
      suggestion: "Use one of: object, array, string, number, integer, boolean, null.",
    });
  }

  if ("properties" in schema && !isRecord(schema.properties)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_PROPERTIES",
      message: `Command at index ${commandIndex} ${schemaPath}.properties must be an object.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "properties"),
      suggestion: "Change properties to an object whose values are schema objects.",
    });
  }

  if ("required" in schema && !isStringArray(schema.required)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_REQUIRED",
      message: `Command at index ${commandIndex} ${schemaPath}.required must be an array of field names.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "required"),
      suggestion: "Change required to an array of string field names.",
    });
  }

  if ("items" in schema && schema.items !== undefined && !isRecord(schema.items)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_ITEMS",
      message: `Command at index ${commandIndex} ${schemaPath}.items must be a schema object.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "items"),
      suggestion: "Change items to a schema object.",
    });
  }

  if ("allOf" in schema && !isSchemaArray(schema.allOf)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_ALLOF",
      message: `Command at index ${commandIndex} ${schemaPath}.allOf must be an array of schema objects.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "allOf"),
      suggestion: "Change allOf to an array of schema objects, or remove it.",
    });
  }

  if (
    "additionalProperties" in schema &&
    typeof schema.additionalProperties !== "boolean" &&
    schema.additionalProperties !== undefined &&
    !isRecord(schema.additionalProperties)
  ) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_ADDITIONAL_PROPERTIES",
      message: `Command at index ${commandIndex} ${schemaPath}.additionalProperties must be a boolean or schema object.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "additionalProperties"),
      suggestion: "Change additionalProperties to true, false, or a schema object.",
    });
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSchemaArray(value: unknown): value is JsonRecord[] {
  return Array.isArray(value) && value.every(isRecord);
}
