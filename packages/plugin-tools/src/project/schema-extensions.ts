import type { PluginManifest } from "@tooldeck/protocol";

import type { PluginProjectDiagnostic } from "./types";
import { type JsonRecord, isRecord } from "./utils";

export function checkSupportedSchemaExtensions(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  manifest.contributes?.commands?.forEach((command, commandIndex) => {
    const inputSchema = command.inputSchema;

    if (isRecord(inputSchema)) {
      checkRootInputSchemaUi(inputSchema, manifestPath, commandIndex, diagnostics);
      walkSchema(inputSchema, (schema, schemaPath) => {
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

  if (
    control !== "text" &&
    control !== "textarea" &&
    control !== "number" &&
    control !== "checkbox" &&
    control !== "radio" &&
    control !== "select" &&
    control !== "checkboxGroup" &&
    control !== "multiSelect"
  ) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `Unsupported x-ui.control on ${propertyName}: ${String(control)}`,
      path: manifestPath,
    });
  }
}

function walkSchema(value: unknown, visit: (schema: JsonRecord, schemaPath: string) => void): void {
  walkSchemaInner(value, "$", visit);
}

function walkSchemaInner(
  value: unknown,
  schemaPath: string,
  visit: (schema: JsonRecord, schemaPath: string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkSchemaInner(item, `${schemaPath}[${index}]`, visit));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  visit(value, schemaPath);

  for (const [key, item] of Object.entries(value)) {
    walkSchemaInner(item, `${schemaPath}.${key}`, visit);
  }
}
