import type { JsonValue } from "@tooldeck/protocol";
import type Ajv from "ajv";
import type { ValidateFunction } from "ajv";

import type {
  JsonSchemaCompilationResult,
  JsonSchemaCompilationError,
  JsonSchemaIssue,
  JsonSchemaValidationError,
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
    return { compiled: false, error: compilationError([createCompilationIssue(error)]) };
  }
}

/** @internal */
export function compiledValidator<T>(
  validate: ValidateFunction<T>,
  semanticValidation?: (value: T) => JsonSchemaIssue[],
  classifyIssues?: (issues: JsonSchemaIssue[]) => JsonSchemaIssue[],
): JsonSchemaCompilationResult<T> {
  const validator: TooldeckJsonSchemaValidator<T> = {
    validate(value: unknown) {
      const cloned = cloneJsonValue(value);

      if (!cloned.valid) {
        return { valid: false, error: cloned.error };
      }

      if (!validate(cloned.value)) {
        const issues = normalizeAjvErrors(validate.errors ?? [], cloned.value);

        return {
          valid: false,
          error: validationError(classifyIssues?.(issues) ?? issues),
        };
      }

      const typedValue = cloned.value as T;
      const semanticIssues = semanticValidation?.(typedValue) ?? [];

      return semanticIssues.length > 0
        ? { valid: false, error: validationError(semanticIssues) }
        : { valid: true, value: typedValue };
    },
  };

  return { compiled: true, validator };
}

/** @internal */
export function validationError(issues: JsonSchemaIssue[]): JsonSchemaValidationError {
  return {
    kind: "validation",
    code: "value_does_not_match_schema",
    message: "Value does not match JSON Schema",
    issues,
  };
}

/** @internal */
export function compilationError(issues: JsonSchemaIssue[]): JsonSchemaCompilationError {
  return {
    kind: "compilation",
    code: "schema_could_not_be_compiled",
    message: "JSON Schema could not be compiled",
    issues,
  };
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
