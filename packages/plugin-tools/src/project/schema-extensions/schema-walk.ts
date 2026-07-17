import { type JsonRecord, isRecord } from "../utils";

export interface SchemaNode {
  schema: JsonRecord;
  schemaPath: string;
  parentSchemaPath?: string;
  parentKeyword?: string;
  key?: string;
}

type SchemaVisitor = (node: SchemaNode) => void;

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

const schemaArrayKeywords = ["allOf", "anyOf", "oneOf"] as const;
const schemaMapKeywords = [
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const;

export function walkSchemaNodes(value: unknown, visit: SchemaVisitor): void {
  walkSchemaNodeInner(value, { schemaPath: "$" }, visit);
}

function walkSchemaNodeInner(
  value: unknown,
  context: Omit<SchemaNode, "schema">,
  visit: SchemaVisitor,
): void {
  if (!isRecord(value)) {
    return;
  }

  visit({ schema: value, ...context });

  for (const keyword of schemaMapKeywords) {
    const schemas = value[keyword];

    if (!isRecord(schemas)) {
      continue;
    }

    for (const [key, schema] of Object.entries(schemas)) {
      walkSchemaNodeInner(
        schema,
        {
          schemaPath: `${context.schemaPath}.${keyword}.${key}`,
          parentSchemaPath: context.schemaPath,
          parentKeyword: keyword,
          key,
        },
        visit,
      );
    }
  }

  const items = value.items;

  if (Array.isArray(items)) {
    items.forEach((schema, index) => {
      walkSchemaNodeInner(
        schema,
        {
          schemaPath: `${context.schemaPath}.items[${index}]`,
          parentSchemaPath: context.schemaPath,
          parentKeyword: "items",
          key: String(index),
        },
        visit,
      );
    });
  } else {
    walkChildSchema(value, context.schemaPath, "items", visit);
  }

  for (const keyword of singleSchemaKeywords) {
    walkChildSchema(value, context.schemaPath, keyword, visit);
  }

  for (const keyword of schemaArrayKeywords) {
    const schemas = value[keyword];

    if (!Array.isArray(schemas)) {
      continue;
    }

    schemas.forEach((schema, index) => {
      walkSchemaNodeInner(
        schema,
        {
          schemaPath: `${context.schemaPath}.${keyword}[${index}]`,
          parentSchemaPath: context.schemaPath,
          parentKeyword: keyword,
          key: String(index),
        },
        visit,
      );
    });
  }

  const dependencies = value.dependencies;

  if (isRecord(dependencies)) {
    for (const [key, schema] of Object.entries(dependencies)) {
      if (isRecord(schema)) {
        walkSchemaNodeInner(
          schema,
          {
            schemaPath: `${context.schemaPath}.dependencies.${key}`,
            parentSchemaPath: context.schemaPath,
            parentKeyword: "dependencies",
            key,
          },
          visit,
        );
      }
    }
  }
}

function walkChildSchema(
  schema: JsonRecord,
  schemaPath: string,
  keyword: string,
  visit: SchemaVisitor,
): void {
  const child = schema[keyword];

  if (!isRecord(child)) {
    return;
  }

  walkSchemaNodeInner(
    child,
    {
      schemaPath: `${schemaPath}.${keyword}`,
      parentSchemaPath: schemaPath,
      parentKeyword: keyword,
    },
    visit,
  );
}
