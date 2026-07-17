interface ManifestSemanticError {
  path: string;
  message: string;
  keyword: string;
}

import { escapeJsonPointer, isRecord, walkSchema } from "./manifest-schema-walk";

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

type FieldUiControl = keyof typeof fieldUiAllowedKeysByControl;

export function collectCommandSchemaUiErrors(
  inputSchema: unknown,
  outputSchema: unknown,
  commandIndex: number,
): ManifestSemanticError[] {
  const errors: ManifestSemanticError[] = [];
  const inputPath = `/contributes/commands/${commandIndex}/inputSchema`;
  const outputPath = `/contributes/commands/${commandIndex}/outputSchema`;

  if (isRecord(inputSchema)) {
    walkSchema(inputSchema, inputPath, (node) => {
      if (node.path === inputPath) {
        validateRootUi(node.schema, node.path, errors);
      } else if (node.parentKeyword === "properties" && node.parentPath === inputPath) {
        validateFieldUi(node.schema, node.path, errors);
      } else if ("x-ui" in node.schema) {
        errors.push({
          path: `${node.path}/x-ui`,
          message: "is only supported at the input schema root or on its direct properties",
          keyword: "x-ui",
        });
      }
    });
  }

  if (isRecord(outputSchema)) {
    walkSchema(outputSchema, outputPath, (node) => {
      if ("x-ui" in node.schema) {
        errors.push({
          path: `${node.path}/x-ui`,
          message: "is not supported on command output schemas",
          keyword: "x-ui",
        });
      }
    });
  }

  return errors;
}

function validateRootUi(
  schema: Record<string, unknown>,
  schemaPath: string,
  errors: ManifestSemanticError[],
): void {
  const ui = schema["x-ui"];

  if (ui === undefined) {
    return;
  }

  const uiPath = `${schemaPath}/x-ui`;

  if (!isRecord(ui)) {
    errors.push({ path: uiPath, message: "must be an object", keyword: "x-ui" });
    return;
  }

  for (const key of Object.keys(ui)) {
    if (key !== "fieldOrder") {
      errors.push({
        path: `${uiPath}/${escapeJsonPointer(key)}`,
        message: "is not a supported input schema x-ui property",
        keyword: "x-ui",
      });
    }
  }

  if (ui.fieldOrder === undefined) {
    return;
  }

  const fieldOrderPath = `${uiPath}/fieldOrder`;

  if (!Array.isArray(ui.fieldOrder)) {
    errors.push({
      path: fieldOrderPath,
      message: "must be an array of input field names",
      keyword: "x-ui.fieldOrder",
    });
    return;
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  const propertyKeys = new Set(Object.keys(properties));
  const seen = new Set<string>();

  ui.fieldOrder.forEach((fieldName, fieldIndex) => {
    const itemPath = `${fieldOrderPath}/${fieldIndex}`;

    if (typeof fieldName !== "string" || fieldName.length === 0) {
      errors.push({
        path: itemPath,
        message: "must be a non-empty input field name",
        keyword: "x-ui.fieldOrder",
      });
    } else if (seen.has(fieldName)) {
      errors.push({
        path: itemPath,
        message: `duplicates input field '${fieldName}'`,
        keyword: "x-ui.fieldOrder",
      });
    } else {
      seen.add(fieldName);

      if (!propertyKeys.has(fieldName)) {
        errors.push({
          path: itemPath,
          message: `references unknown input field '${fieldName}'`,
          keyword: "x-ui.fieldOrder",
        });
      }
    }
  });
}

function validateFieldUi(
  schema: Record<string, unknown>,
  schemaPath: string,
  errors: ManifestSemanticError[],
): void {
  const ui = schema["x-ui"];

  if (ui === undefined) {
    return;
  }

  const uiPath = `${schemaPath}/x-ui`;

  if (!isRecord(ui)) {
    errors.push({ path: uiPath, message: "must be an object", keyword: "x-ui" });
    return;
  }

  if (!isFieldUiControl(ui.control)) {
    errors.push({
      path: `${uiPath}/control`,
      message: "must be a supported input control",
      keyword: "x-ui.control",
    });
    return;
  }

  const control = ui.control;
  const allowedKeys: ReadonlySet<string> = fieldUiAllowedKeysByControl[control];

  for (const key of Object.keys(ui)) {
    if (!allowedKeys.has(key)) {
      errors.push({
        path: `${uiPath}/${escapeJsonPointer(key)}`,
        message: `is not supported by the ${control} input control`,
        keyword: "x-ui",
      });
    }
  }

  if ("rows" in ui && (!Number.isInteger(ui.rows) || Number(ui.rows) <= 0)) {
    errors.push({
      path: `${uiPath}/rows`,
      message: "must be a positive integer",
      keyword: "x-ui.rows",
    });
  }

  if ("placeholder" in ui && !isLocalizedString(ui.placeholder)) {
    errors.push({
      path: `${uiPath}/placeholder`,
      message: "must be a LocalizedString",
      keyword: "x-ui.placeholder",
    });
  }

  if (!isControlCompatible(schema, control)) {
    errors.push({
      path: `${uiPath}/control`,
      message: `is incompatible with the field schema for the ${control} input control`,
      keyword: "x-ui.control",
    });
  }
}

function isControlCompatible(schema: Record<string, unknown>, control: FieldUiControl): boolean {
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

  return (
    type === "array" &&
    isRecord(schema.items) &&
    Array.isArray(schema.items.enum) &&
    schema.items.enum.length > 0
  );
}

function isFieldUiControl(value: unknown): value is FieldUiControl {
  return typeof value === "string" && value in fieldUiAllowedKeysByControl;
}

function isLocalizedString(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (isRecord(value) &&
      Object.keys(value).every((key) => key === "key" || key === "default") &&
      typeof value.key === "string" &&
      typeof value.default === "string")
  );
}
