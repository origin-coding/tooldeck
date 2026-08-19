import type { JsonObject, PluginManifest } from "@tooldeck/protocol";
import { describe, expectTypeOf, it } from "vitest";

import type {
  JsonSchemaCompilationResult,
  JsonSchemaCompilationError,
  JsonSchemaIssue,
  JsonSchemaValidationError,
  JsonSchemaValidationResult,
  TooldeckJsonSchemaEngine,
  TooldeckJsonSchemaValidator,
} from "../src";
import { createTooldeckJsonSchemaEngine } from "../src";

describe("public JSON Schema contracts", () => {
  it("keeps validation results independent from Ajv types", () => {
    expectTypeOf<TooldeckJsonSchemaValidator<JsonObject>["validate"]>().returns.toEqualTypeOf<
      JsonSchemaValidationResult<JsonObject>
    >();
    expectTypeOf<JsonSchemaIssue["actual"]>().toEqualTypeOf<
      import("@tooldeck/protocol").JsonValue | undefined
    >();
    expectTypeOf<JsonSchemaIssue>().toMatchTypeOf<JsonObject>();
    expectTypeOf<JsonSchemaValidationError>().toMatchTypeOf<JsonObject>();
    expectTypeOf<JsonSchemaCompilationError>().toMatchTypeOf<JsonObject>();
  });

  it("provides typed results for fixed engine roles", () => {
    expectTypeOf<TooldeckJsonSchemaEngine["compileManifest"]>().returns.toEqualTypeOf<
      JsonSchemaCompilationResult<PluginManifest>
    >();
    expectTypeOf(createTooldeckJsonSchemaEngine()).toEqualTypeOf<TooldeckJsonSchemaEngine>();
  });
});
