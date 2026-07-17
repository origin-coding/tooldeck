import type { PluginProjectDiagnostic } from "../types";
import { type JsonRecord, isRecord } from "../utils";
import { inputFieldUiPath, inputSchemaFieldPath, outputSchemaFieldPath } from "./diagnostic-paths";

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

export function checkRootInputSchemaUi(
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
      pushFieldOrderDiagnostic(
        commandIndex,
        manifestPath,
        diagnostics,
        "inputSchema.x-ui.fieldOrder must contain non-empty field names.",
        "Use only non-empty string field names in fieldOrder.",
      );
      continue;
    }

    if (seen.has(fieldName)) {
      pushFieldOrderDiagnostic(
        commandIndex,
        manifestPath,
        diagnostics,
        `inputSchema.x-ui.fieldOrder duplicates field: ${fieldName}`,
        `Remove the duplicate "${fieldName}" entry from fieldOrder.`,
      );
      continue;
    }

    seen.add(fieldName);

    if (!propertyKeys.has(fieldName)) {
      pushFieldOrderDiagnostic(
        commandIndex,
        manifestPath,
        diagnostics,
        `inputSchema.x-ui.fieldOrder references unknown field: ${fieldName}`,
        `Add "${fieldName}" to inputSchema.properties or remove it from fieldOrder.`,
      );
    }
  }
}

export function checkInputFieldUi(
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
      suggestion:
        "Use a supported control: text, textarea, number, checkbox, radio, select, checkboxGroup, or multiSelect.",
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

  if ("rows" in ui && (!Number.isInteger(ui.rows) || Number(ui.rows) <= 0)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `x-ui.rows on ${propertyName} must be a positive integer.`,
      path: manifestPath,
      fieldPath: inputFieldUiPath(commandIndex, propertyName, "rows"),
      suggestion: "Change x-ui.rows to a positive integer.",
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

  if (!isControlCompatible(schema, supportedControl)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI_CONTROL",
      message: `x-ui.control ${supportedControl} is incompatible with the schema for ${propertyName}.`,
      path: manifestPath,
      fieldPath: inputFieldUiPath(commandIndex, propertyName, "control"),
      suggestion: "Use a control compatible with the field type and enum shape.",
    });
  }
}

export function checkNestedInputSchemaUi(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  schemaPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  if (!("x-ui" in schema)) {
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "INPUT_SCHEMA_NESTED_X_UI",
    message: `Command at index ${commandIndex} ${schemaPath} must not use x-ui.`,
    path: manifestPath,
    fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-ui"),
    suggestion: "Move x-ui to the input schema root or one of its direct properties.",
  });
}

export function checkOutputSchemaUi(
  commandId: string,
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  schemaPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  if (!("x-ui" in schema)) {
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "OUTPUT_SCHEMA_X_UI",
    message: `Command ${commandId} outputSchema must not use x-ui.`,
    path: manifestPath,
    fieldPath: outputSchemaFieldPath(commandIndex, schemaPath, "x-ui"),
    suggestion:
      "Remove x-ui from outputSchema. UI hints are only supported on command input schemas.",
  });
}

function pushFieldOrderDiagnostic(
  commandIndex: number,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
  message: string,
  suggestion: string,
): void {
  diagnostics.push({
    severity: "error",
    code: "INPUT_SCHEMA_FIELD_ORDER",
    message,
    path: manifestPath,
    fieldPath: `contributes.commands[${commandIndex}].inputSchema.x-ui.fieldOrder`,
    suggestion,
  });
}

function isControlCompatible(schema: JsonRecord, control: SupportedFieldUiControl): boolean {
  const type = typeof schema.type === "string" ? schema.type : undefined;

  if (control === "text" || control === "textarea") {
    return type === "string";
  }

  if (control === "number") {
    return type === "number" || type === "integer";
  }

  if (control === "checkbox") {
    return type === "boolean";
  }

  if (control === "radio" || control === "select") {
    return type === "string" && Array.isArray(schema.enum) && schema.enum.length > 0;
  }

  if (control === "checkboxGroup" || control === "multiSelect") {
    return (
      type === "array" &&
      isRecord(schema.items) &&
      Array.isArray(schema.items.enum) &&
      schema.items.enum.length > 0
    );
  }

  return false;
}

function isSupportedFieldUiControl(value: unknown): value is SupportedFieldUiControl {
  return typeof value === "string" && value in fieldUiAllowedKeysByControl;
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
