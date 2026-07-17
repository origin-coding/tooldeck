interface SchemaNode {
  schema: Record<string, unknown>;
  path: string;
  parentPath?: string;
  parentKeyword?: string;
}

const schemaMapKeywords = [
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const;
const schemaArrayKeywords = ["allOf", "anyOf", "oneOf"] as const;
const singleSchemaKeywords = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "else",
  "if",
  "not",
  "propertyNames",
  "then",
] as const;

export function walkSchema(
  schema: Record<string, unknown>,
  path: string,
  visit: (node: SchemaNode) => void,
  parentPath?: string,
  parentKeyword?: string,
): void {
  visit({ schema, path, parentPath, parentKeyword });

  for (const keyword of schemaMapKeywords) {
    const schemas = schema[keyword];

    if (!isRecord(schemas)) {
      continue;
    }

    for (const [key, child] of Object.entries(schemas)) {
      walkChildSchema(child, `${path}/${keyword}/${escapeJsonPointer(key)}`, path, keyword, visit);
    }
  }

  if (Array.isArray(schema.items)) {
    schema.items.forEach((child, index) => {
      walkChildSchema(child, `${path}/items/${index}`, path, "items", visit);
    });
  } else {
    walkChildSchema(schema.items, `${path}/items`, path, "items", visit);
  }

  for (const keyword of singleSchemaKeywords) {
    walkChildSchema(schema[keyword], `${path}/${keyword}`, path, keyword, visit);
  }

  for (const keyword of schemaArrayKeywords) {
    const schemas = schema[keyword];

    if (Array.isArray(schemas)) {
      schemas.forEach((child, index) => {
        walkChildSchema(child, `${path}/${keyword}/${index}`, path, keyword, visit);
      });
    }
  }

  if (isRecord(schema.dependencies)) {
    for (const [key, child] of Object.entries(schema.dependencies)) {
      walkChildSchema(
        child,
        `${path}/dependencies/${escapeJsonPointer(key)}`,
        path,
        "dependencies",
        visit,
      );
    }
  }
}

function walkChildSchema(
  value: unknown,
  path: string,
  parentPath: string,
  parentKeyword: string,
  visit: (node: SchemaNode) => void,
): void {
  if (isRecord(value)) {
    walkSchema(value, path, visit, parentPath, parentKeyword);
  }
}

export function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
