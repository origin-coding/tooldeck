import type { JsonValue } from "@tooldeck/protocol";
import type Ajv from "ajv";
import type { ValidateFunction } from "ajv";

import type {
  JsonSchemaCompilationResult,
  JsonSchemaIssue,
  TooldeckJsonSchemaValidator,
} from "../contracts";
import { createCompilationIssue, normalizeAjvErrors } from "./issues";
import { cloneJsonValue } from "./json";

/** @internal */
export function compileWithAjv<T>(
  ajv: Ajv,
  schema: object | boolean,
  semanticValidation?: (value: T) => JsonSchemaIssue[],
): JsonSchemaCompilationResult<T> {
  try {
    return compiledValidator(ajv.compile<T>(schema), semanticValidation);
  } catch (error) {
    return { compiled: false, issues: [createCompilationIssue(error)] };
  }
}

/** @internal */
export function compiledValidator<T>(
  validate: ValidateFunction<T>,
  semanticValidation?: (value: T) => JsonSchemaIssue[],
): JsonSchemaCompilationResult<T> {
  const validator: TooldeckJsonSchemaValidator<T> = {
    validate(value: unknown) {
      const cloned = cloneJsonValue(value);

      if (!cloned.valid) {
        return cloned;
      }

      if (!validate(cloned.value)) {
        return {
          valid: false,
          issues: normalizeAjvErrors(validate.errors ?? [], cloned.value),
        };
      }

      const typedValue = cloned.value as T;
      const semanticIssues = semanticValidation?.(typedValue) ?? [];

      return semanticIssues.length > 0
        ? { valid: false, issues: semanticIssues }
        : { valid: true, value: typedValue };
    },
  };

  return { compiled: true, validator };
}

/** @internal */
export function validateSchemaProfile(
  validate: ValidateFunction,
  schema: JsonValue,
): JsonSchemaIssue[] {
  if (validate(schema)) {
    return [];
  }

  return normalizeAjvErrors(validate.errors ?? [], schema);
}
