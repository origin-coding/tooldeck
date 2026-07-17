import type { PluginProjectDiagnostic } from "../types";
import { type JsonRecord, isRecord } from "../utils";
import { inputSchemaFieldPath } from "./diagnostic-paths";

export function checkSchemaI18n(
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

  for (const key of ["title", "description"] as const) {
    if (key in i18n && typeof i18n[key] !== "string") {
      diagnostics.push({
        severity: "error",
        code: "SCHEMA_X_I18N",
        message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.${key} must be a locale key string.`,
        path: manifestPath,
        fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, `x-i18n.${key}`),
        suggestion: `Change x-i18n.${key} to a locale key string.`,
      });
    }
  }

  if (!("enumLabels" in i18n)) {
    return;
  }

  if (!isRecord(i18n.enumLabels)) {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n.enumLabels must be an object of locale key strings.`,
      path: manifestPath,
      fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, "x-i18n.enumLabels"),
      suggestion:
        "Change x-i18n.enumLabels to an object mapping enum values to locale key strings.",
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
        fieldPath: inputSchemaFieldPath(commandIndex, schemaPath, `x-i18n.enumLabels.${enumValue}`),
        suggestion: `Change the enum label for "${enumValue}" to a locale key string.`,
      });
    }
  }
}
