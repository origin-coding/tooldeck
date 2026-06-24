import type { PluginManifest } from "@tooldeck/protocol";

import type { PluginProjectDiagnostic } from "./types";
import { type JsonRecord, isRecord } from "./utils";

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

const fieldUiAllowedKeysByControl = {
  text: new Set(["control", "placeholder"]),
  textarea: new Set(["control", "rows", "placeholder"]),
  number: new Set(["control", "placeholder"]),
  checkbox: new Set(["control"]),
  radio: new Set(["control"]),
  select: new Set(["control", "placeholder"]),
  checkboxGroup: new Set(["control"]),
  multiSelect: new Set(["control", "placeholder"]),
} as const;

type SupportedFieldUiControl = keyof typeof fieldUiAllowedKeysByControl;

export function checkSupportedSchemaExtensions(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  manifest.contributes?.commands?.forEach((command, commandIndex) => {
    const inputSchema = command.inputSchema;

    if (isRecord(inputSchema)) {
      checkRootInputSchemaUi(inputSchema, manifestPath, commandIndex, diagnostics);
      walkSchemaNodes(inputSchema, (schema, schemaPath) => {
        checkInputSchemaSubset(schema, manifestPath, commandIndex, schemaPath, diagnostics);
        checkSchemaI18n(schema, manifestPath, commandIndex, schemaPath, diagnostics);
      });

      const properties = isRecord(inputSchema.properties) ? inputSchema.properties : {};

      for (const [propertyName, propertySchema] of Object.entries(properties)) {
        if (!isRecord(propertySchema)) {
          continue;
        }

        checkInputFieldUi(
          propertySchema,
          manifestPath,
          commandIndex,
          propertyName,
          diagnostics,
        );
      }
    }

    const outputSchema = command.outputSchema;

    if (isRecord(outputSchema) && "x-ui" in outputSchema) {
      diagnostics.push({
        severity: "error",
        code: "OUTPUT_SCHEMA_X_UI",
        message: `Command ${command.id} outputSchema must not use x-ui.`,
        path: manifestPath,
      });
    }
  });
}

function checkInputSchemaSubset(
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
    });
  } else if (type !== undefined && !supportedSchemaTypes.has(String(type))) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_UNSUPPORTED_TYPE",
      message: `Command at index ${commandIndex} ${schemaPath}.type is unsupported: ${String(type)}`,
      path: manifestPath,
    });
  }

  if ("properties" in schema && !isRecord(schema.properties)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_PROPERTIES",
      message: `Command at index ${commandIndex} ${schemaPath}.properties must be an object.`,
      path: manifestPath,
    });
  }

  if ("required" in schema && !isStringArray(schema.required)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_REQUIRED",
      message: `Command at index ${commandIndex} ${schemaPath}.required must be an array of field names.`,
      path: manifestPath,
    });
  }

  if ("items" in schema && schema.items !== undefined && !isRecord(schema.items)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_ITEMS",
      message: `Command at index ${commandIndex} ${schemaPath}.items must be a schema object.`,
      path: manifestPath,
    });
  }

  if ("allOf" in schema && !isSchemaArray(schema.allOf)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_ALLOF",
      message: `Command at index ${commandIndex} ${schemaPath}.allOf must be an array of schema objects.`,
      path: manifestPath,
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
    });
  }
}

function checkRootInputSchemaUi(
  inputSchema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const ui = inputSchema["x-ui"];

  if (ui === undefined) {
    return;
  }

  if (!isRecord(ui)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_X_UI",
      message: `Command at index ${commandIndex} inputSchema.x-ui must be an object.`,
      path: manifestPath,
    });

    return;
  }

  for (const key of Object.keys(ui)) {
    if (key !== "fieldOrder") {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_X_UI",
        message: `Unsupported inputSchema.x-ui property: ${key}`,
        path: manifestPath,
      });
    }
  }

  const fieldOrder = ui.fieldOrder;

  if (fieldOrder === undefined) {
    return;
  }

  if (!Array.isArray(fieldOrder)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_FIELD_ORDER",
      message: "inputSchema.x-ui.fieldOrder must be an array.",
      path: manifestPath,
    });

    return;
  }

  const properties = isRecord(inputSchema.properties) ? inputSchema.properties : {};
  const propertyKeys = new Set(Object.keys(properties));
  const seen = new Set<string>();

  for (const fieldName of fieldOrder) {
    if (typeof fieldName !== "string" || !fieldName) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: "inputSchema.x-ui.fieldOrder must contain non-empty field names.",
        path: manifestPath,
      });
      continue;
    }

    if (seen.has(fieldName)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: `inputSchema.x-ui.fieldOrder duplicates field: ${fieldName}`,
        path: manifestPath,
      });
      continue;
    }

    seen.add(fieldName);

    if (!propertyKeys.has(fieldName)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: `inputSchema.x-ui.fieldOrder references unknown field: ${fieldName}`,
        path: manifestPath,
      });
    }
  }
}

function checkSchemaI18n(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  schemaPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const i18n = schema["x-i18n"];

  if (i18n === undefined) {
    return;
  }

  if (!isRecord(i18n)) {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n must be an object.`,
      path: manifestPath,
    });

    return;
  }

  for (const key of Object.keys(i18n)) {
    if (key !== "title" && key !== "description" && key !== "enumLabels") {
      diagnostics.push({
        severity: "error",
        code: "SCHEMA_X_I18N",
        message: `Unsupported x-i18n property: ${key}`,
        path: manifestPath,
      });
    }
  }

  if ("title" in i18n && typeof i18n.title !== "string") {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.title must be a locale key string.`,
      path: manifestPath,
    });
  }

  if ("description" in i18n && typeof i18n.description !== "string") {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.description must be a locale key string.`,
      path: manifestPath,
    });
  }

  if ("enumLabels" in i18n) {
    if (!isRecord(i18n.enumLabels)) {
      diagnostics.push({
        severity: "error",
        code: "SCHEMA_X_I18N",
        message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.enumLabels must be an object of locale key strings.`,
        path: manifestPath,
      });
      return;
    }

    for (const [enumValue, localeKey] of Object.entries(i18n.enumLabels)) {
      if (typeof localeKey !== "string") {
        diagnostics.push({
          severity: "error",
          code: "SCHEMA_X_I18N",
          message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.enumLabels.${enumValue} must be a locale key string.`,
          path: manifestPath,
        });
      }
    }
  }
}

function checkInputFieldUi(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  propertyName: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const ui = schema["x-ui"];

  if (ui === undefined) {
    return;
  }

  if (!isRecord(ui)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `Command at index ${commandIndex} field ${propertyName} x-ui must be an object.`,
      path: manifestPath,
    });

    return;
  }

  const control = ui.control;
  const supportedControl = isSupportedFieldUiControl(control) ? control : undefined;

  if (!supportedControl) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `Unsupported x-ui.control on ${propertyName}: ${String(control)}`,
      path: manifestPath,
    });

    return;
  }

  const allowedKeys = fieldUiAllowedKeysByControl[supportedControl];

  for (const key of Object.keys(ui)) {
    if (!allowedKeys.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_FIELD_X_UI",
        message: `Unsupported x-ui property on ${propertyName} for ${supportedControl} control: ${key}`,
        path: manifestPath,
      });
    }
  }

  if ("rows" in ui && typeof ui.rows !== "number") {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `x-ui.rows on ${propertyName} must be a number.`,
      path: manifestPath,
    });
  }

  if ("placeholder" in ui && !isLocalizedString(ui.placeholder)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `x-ui.placeholder on ${propertyName} must be a LocalizedString.`,
      path: manifestPath,
    });
  }
}

function walkSchemaNodes(
  value: unknown,
  visit: (schema: JsonRecord, schemaPath: string) => void,
): void {
  walkSchemaNodeInner(value, "$", visit);
}

function walkSchemaNodeInner(
  value: unknown,
  schemaPath: string,
  visit: (schema: JsonRecord, schemaPath: string) => void,
): void {
  if (!isRecord(value)) {
    return;
  }

  visit(value, schemaPath);

  if (isRecord(value.properties)) {
    for (const [propertyName, propertySchema] of Object.entries(value.properties)) {
      walkSchemaNodeInner(propertySchema, `${schemaPath}.properties.${propertyName}`, visit);
    }
  }

  if (isRecord(value.items)) {
    walkSchemaNodeInner(value.items, `${schemaPath}.items`, visit);
  }

  if (isRecord(value.additionalProperties)) {
    walkSchemaNodeInner(value.additionalProperties, `${schemaPath}.additionalProperties`, visit);
  }

  if (Array.isArray(value.allOf)) {
    value.allOf.forEach((item, index) => {
      walkSchemaNodeInner(item, `${schemaPath}.allOf[${index}]`, visit);
    });
  }
}

function isSupportedFieldUiControl(value: unknown): value is SupportedFieldUiControl {
  return typeof value === "string" && value in fieldUiAllowedKeysByControl;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSchemaArray(value: unknown): value is JsonRecord[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isLocalizedString(value: unknown): boolean {
  if (typeof value === "string") {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value).every((key) => key === "key" || key === "default") &&
    typeof value.key === "string" &&
    typeof value.default === "string"
  );
}
