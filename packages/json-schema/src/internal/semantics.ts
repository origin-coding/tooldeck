import type { JsonObject, JsonValue, PluginManifest } from "@tooldeck/protocol";

import type { JsonSchemaIssue, JsonSchemaIssueCode } from "../contracts";
import { compareIssues } from "./issues";
import { appendJsonPointer, escapeJsonPointer, jsonPointerToPropertyPath } from "./json";
import { walkJsonSchema } from "./schema-walk";

const fieldControls = new Set([
  "text",
  "textarea",
  "number",
  "checkbox",
  "radio",
  "select",
  "checkboxGroup",
  "multiSelect",
]);

/** @internal */
export function collectManifestSemanticIssues(manifest: PluginManifest): JsonSchemaIssue[] {
  const issues: JsonSchemaIssue[] = [];

  manifest.contributes?.commands?.forEach((command, commandIndex) => {
    if (command.inputSchema) {
      issues.push(
        ...collectInputSchemaSemanticIssues(
          command.inputSchema as unknown as JsonObject,
          `/contributes/commands/${commandIndex}/inputSchema`,
        ),
      );
    }
  });

  return issues.sort(compareIssues);
}

/** @internal */
export function collectInputSchemaSemanticIssues(
  schema: JsonObject,
  basePointer = "",
): JsonSchemaIssue[] {
  const issues: JsonSchemaIssue[] = [];

  collectFieldOrderIssues(schema, basePointer, issues);
  collectDirectFieldUiIssues(schema, basePointer, issues);
  walkJsonSchemaAtPointer(schema, basePointer, (node, pointer) => {
    collectEnumLabelIssues(node, pointer, "x-enumLabels", issues);

    const i18n = isJsonObject(node["x-i18n"]) ? node["x-i18n"] : undefined;

    if (i18n && isJsonObject(i18n.enumLabels)) {
      collectEnumLabelMapIssues(node, i18n.enumLabels, `${pointer}/x-i18n/enumLabels`, issues);
    }
  });

  return issues.sort(compareIssues);
}

function collectFieldOrderIssues(
  schema: JsonObject,
  basePointer: string,
  issues: JsonSchemaIssue[],
): void {
  const ui = isJsonObject(schema["x-ui"]) ? schema["x-ui"] : undefined;
  const fieldOrder = ui?.fieldOrder;

  if (!Array.isArray(fieldOrder)) {
    return;
  }

  const properties = isJsonObject(schema.properties) ? schema.properties : {};

  fieldOrder.forEach((fieldName, fieldIndex) => {
    if (typeof fieldName !== "string" || Object.hasOwn(properties, fieldName)) {
      return;
    }

    const pointer = `${basePointer}/x-ui/fieldOrder/${fieldIndex}`;
    issues.push(
      createSemanticIssue(
        pointer,
        "tooldeck.input-ui.field-order.unknown-property",
        "x-ui.fieldOrder",
        "Field order references an unknown input property",
        Object.keys(properties),
        fieldName,
      ),
    );
  });
}

function collectDirectFieldUiIssues(
  schema: JsonObject,
  basePointer: string,
  issues: JsonSchemaIssue[],
): void {
  const properties = isJsonObject(schema.properties) ? schema.properties : undefined;

  if (!properties) {
    return;
  }

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    if (!isJsonObject(propertySchema)) {
      continue;
    }

    const ui = isJsonObject(propertySchema["x-ui"]) ? propertySchema["x-ui"] : undefined;
    const control = ui?.control;

    if (typeof control !== "string" || !fieldControls.has(control)) {
      continue;
    }

    if (isControlCompatible(propertySchema, control)) {
      continue;
    }

    const pointer = `${basePointer}/properties/${escapeJsonPointer(propertyName)}/x-ui/control`;
    issues.push(
      createSemanticIssue(
        pointer,
        "tooldeck.input-ui.control.incompatible",
        "x-ui.control",
        "Input control is incompatible with the field schema",
        expectedTypesForControl(control),
        control,
      ),
    );
  }
}

function collectEnumLabelIssues(
  schema: JsonObject,
  pointer: string,
  keyword: "x-enumLabels",
  issues: JsonSchemaIssue[],
): void {
  const labels = schema[keyword];

  if (!isJsonObject(labels)) {
    return;
  }

  collectEnumLabelMapIssues(schema, labels, `${pointer}/${keyword}`, issues);
}

function collectEnumLabelMapIssues(
  schema: JsonObject,
  labels: JsonObject,
  pointer: string,
  issues: JsonSchemaIssue[],
): void {
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

  if (!enumValues) {
    issues.push(
      createSemanticIssue(
        pointer,
        "tooldeck.enum-labels.missing-enum",
        "enumLabels",
        "Enum labels require an enum on the same schema",
        "enum",
        labels,
      ),
    );
    return;
  }

  const enumKeys = new Set(enumValues.map(enumValueToLabelKey));

  for (const labelKey of Object.keys(labels)) {
    if (enumKeys.has(labelKey)) {
      continue;
    }

    const labelPointer = appendJsonPointer(pointer, labelKey);
    issues.push(
      createSemanticIssue(
        labelPointer,
        "tooldeck.enum-labels.unknown-value",
        "enumLabels",
        "Enum label does not match an enum value",
        [...enumKeys],
        labelKey,
      ),
    );
  }
}

function walkJsonSchemaAtPointer(
  schema: JsonObject,
  pointer: string,
  visit: (schema: JsonObject, pointer: string) => void,
): void {
  walkJsonSchema(schema, (node, relativePointer) => visit(node, `${pointer}${relativePointer}`));
}

function isControlCompatible(schema: JsonObject, control: string): boolean {
  if (control === "text" || control === "textarea") {
    return schema.type === "string";
  }

  if (control === "number") {
    return schema.type === "number" || schema.type === "integer";
  }

  if (control === "checkbox") {
    return schema.type === "boolean";
  }

  if (control === "radio" || control === "select") {
    return schema.type === "string" && Array.isArray(schema.enum) && schema.enum.length > 0;
  }

  if (control === "checkboxGroup" || control === "multiSelect") {
    return (
      schema.type === "array" &&
      isJsonObject(schema.items) &&
      Array.isArray(schema.items.enum) &&
      schema.items.enum.length > 0
    );
  }

  return false;
}

function expectedTypesForControl(control: string): JsonValue[] {
  if (control === "text" || control === "textarea" || control === "radio" || control === "select") {
    return ["string"];
  }

  if (control === "number") {
    return ["number", "integer"];
  }

  if (control === "checkbox") {
    return ["boolean"];
  }

  return ["array"];
}

function enumValueToLabelKey(value: JsonValue): string {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}

function createSemanticIssue(
  instancePath: string,
  code: JsonSchemaIssueCode,
  keyword: string,
  message: string,
  expected?: JsonValue | JsonValue[],
  actual?: JsonValue,
): JsonSchemaIssue {
  return {
    code,
    instancePath,
    propertyPath: jsonPointerToPropertyPath(instancePath),
    keyword,
    message,
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
  };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
