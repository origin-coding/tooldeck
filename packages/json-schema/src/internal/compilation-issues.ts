import type { JsonObject } from "@tooldeck/protocol";

import type { JsonSchemaDocument, JsonSchemaIssue } from "../contracts";
import { compareIssues, deduplicateIssues } from "./issues";
import { appendJsonPointer, jsonPointerToPropertyPath } from "./json";
import { walkJsonSchema } from "./schema-walk";

/** Collect compilation failures that Ajv reports without a usable schema path. */
export function collectSchemaCompilationIssues(schema: JsonSchemaDocument): JsonSchemaIssue[] {
  const issues: JsonSchemaIssue[] = [];

  walkJsonSchema(schema, (node, pointer) => {
    if (typeof node.pattern === "string") {
      collectPatternIssue(node.pattern, appendJsonPointer(pointer, "pattern"), issues);
    }

    collectPatternPropertyIssues(node, pointer, issues);
  });

  return deduplicateIssues(issues.sort(compareIssues));
}

function collectPatternPropertyIssues(
  schema: JsonObject,
  pointer: string,
  issues: JsonSchemaIssue[],
): void {
  const patternProperties = schema.patternProperties;

  if (
    typeof patternProperties !== "object" ||
    patternProperties === null ||
    Array.isArray(patternProperties)
  ) {
    return;
  }

  for (const pattern of Object.keys(patternProperties)) {
    collectPatternIssue(
      pattern,
      appendJsonPointer(appendJsonPointer(pointer, "patternProperties"), pattern),
      issues,
    );
  }
}

function collectPatternIssue(
  pattern: string,
  instancePath: string,
  issues: JsonSchemaIssue[],
): void {
  try {
    new RegExp(pattern, "u");
  } catch {
    issues.push({
      code: "schema.invalid-pattern",
      instancePath,
      propertyPath: jsonPointerToPropertyPath(instancePath),
      keyword: "pattern",
      message: "Pattern is not a valid regular expression",
      actual: pattern,
    });
  }
}
