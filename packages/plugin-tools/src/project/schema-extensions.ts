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
        fieldPath: `contributes.commands[${commandIndex}].outputSchema.x-ui`,
        suggestion: "Remove x-ui from outputSchema. UI hints are only supported on command input schemas.",
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
      fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui`,
      suggestion: "Change inputSchema.x-ui to an object, or remove it.",
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
        fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.${key}`,
        suggestion: "Only inputSchema.x-ui.fieldOrder is supported at the input schema root.",
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
      fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.fieldOrder`,
      suggestion: "Change fieldOrder to an array of field names from inputSchema.properties.",
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
        fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.fieldOrder`,
        suggestion: "Use only non-empty string field names in fieldOrder.",
      });
      continue;
    }

    if (seen.has(fieldName)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: `inputSchema.x-ui.fieldOrder duplicates field: ${fieldName}`,
        path: manifestPath,
        fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.fieldOrder`,
        suggestion: `Remove the duplicate "${fieldName}" entry from fieldOrder.`,
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
        fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.fieldOrder`,
        suggestion: `Add "${fieldName}" to inputSchema.properties or remove it from fieldOrder.`,
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
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-i18n"),
      suggestion: "Change x-i18n to an object containing locale key strings, or remove it.",
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
        fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, `x-i18n.${key}`),
        suggestion: "Only x-i18n.title, x-i18n.description, and x-i18n.enumLabels are supported.",
      });
    }
  }

  if ("title" in i18n && typeof i18n.title !== "string") {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.title must be a locale key string.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-i18n.title"),
      suggestion: "Change x-i18n.title to a locale key string.",
    });
  }

  if ("description" in i18n && typeof i18n.description !== "string") {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.description must be a locale key string.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-i18n.description"),
      suggestion: "Change x-i18n.description to a locale key string.",
    });
  }

  if ("enumLabels" in i18n) {
    if (!isRecord(i18n.enumLabels)) {
      diagnostics.push({
        severity: "error",
        code: "SCHEMA_X_I18N",
        message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.enumLabels must be an object of locale key strings.`,
        path: manifestPath,
        fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-i18n.enumLabels"),
        suggestion: "Change x-i18n.enumLabels to an object mapping enum values to locale key strings.",
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
          fieldPath: inputSchemaFieldPath(
            commandIndex,
            schemaPath,
            `x-i18n.enumLabels.${enumValue}`,
          ),
          suggestion: `Change the enum label for "${enumValue}" to a locale key string.`,
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
      fieldPath: inputFieldUiPath(commandIndex, propertyName),
      suggestion: "Change field x-ui to an object, or remove it.",
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
      fieldPath: inputFieldUiPath(commandIndex, propertyName, "control"),
      suggestion: "Use a supported control: text, textarea, number, checkbox, radio, select, checkboxGroup, or multiSelect.",
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
        fieldPath: inputFieldUiPath(commandIndex, propertyName, key),
        suggestion: `Remove ${key} or use an input control that supports it.`,
      });
    }
  }

  if ("rows" in ui && typeof ui.rows !== "number") {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `x-ui.rows on ${propertyName} must be a number.`,
      path: manifestPath,
      fieldPath: inputFieldUiPath(commandIndex, propertyName, "rows"),
      suggestion: "Change x-ui.rows to a number.",
    });
  }

  if ("placeholder" in ui && !isLocalizedString(ui.placeholder)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `x-ui.placeholder on ${propertyName} must be a LocalizedString.`,
      path: manifestPath,
      fieldPath: inputFieldUiPath(commandIndex, propertyName, "placeholder"),
      suggestion: "Change x-ui.placeholder to a string or { key, default } LocalizedString.",
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

function inputSchemaFieldPath(
  commandIndex: number,
  schemaPath: string,
  suffix?: string,
): string {
  const normalizedSchemaPath =
    schemaPath === "$" ? "" : schemaPath.replace(/^\$\.?/, ".");
  const basePath = `contributes.commands[${commandIndex}].inputSchema${normalizedSchemaPath}`;

  return suffix ? `${basePath}.${suffix}` : basePath;
}

function inputFieldUiPath(commandIndex: number, propertyName: string, suffix?: string): string {
  const basePath = `contributes.commands[${commandIndex}].inputSchema.properties.${propertyName}.x-ui`;

  return suffix ? `${basePath}.${suffix}` : basePath;
}
