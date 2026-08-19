import type { JsonObject } from "@tooldeck/protocol";

import type { JsonSchemaError, JsonSchemaIssue } from "./contracts";

export interface JsonSchemaPathPrefix extends JsonObject {
  instancePath: string;
  propertyPath: string;
}

/** Prefix every issue path in an error without mutating the caller-owned error. */
export function prefixJsonSchemaError<TError extends JsonSchemaError>(
  error: TError,
  prefix: JsonSchemaPathPrefix,
): TError {
  return {
    ...error,
    issues: error.issues.map((issue) => prefixIssue(issue, prefix)),
  } as TError;
}

function prefixIssue(issue: JsonSchemaIssue, prefix: JsonSchemaPathPrefix): JsonSchemaIssue {
  return {
    ...issue,
    instancePath: appendInstancePath(prefix.instancePath, issue.instancePath),
    propertyPath: appendPropertyPath(prefix.propertyPath, issue.propertyPath),
  };
}

function appendInstancePath(prefix: string, relativePath: string): string {
  if (!prefix) {
    return relativePath;
  }

  if (!relativePath) {
    return prefix;
  }

  return `${prefix.endsWith("/") ? prefix.slice(0, -1) : prefix}${relativePath}`;
}

function appendPropertyPath(prefix: string, relativePath: string): string {
  if (!prefix) {
    return relativePath;
  }

  if (!relativePath) {
    return prefix;
  }

  return relativePath.startsWith("[") ? `${prefix}${relativePath}` : `${prefix}.${relativePath}`;
}
