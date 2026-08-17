import type { JsonObject, PluginManifest } from "@tooldeck/protocol";
import { describe, expectTypeOf, it } from "vitest";

import type {
  JsonSchemaCompilationResult,
  JsonSchemaIssue,
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
  });

  it("provides typed results for fixed engine roles", () => {
    expectTypeOf<TooldeckJsonSchemaEngine["compileManifest"]>().returns.toEqualTypeOf<
      JsonSchemaCompilationResult<PluginManifest>
    >();
    expectTypeOf(createTooldeckJsonSchemaEngine()).toEqualTypeOf<TooldeckJsonSchemaEngine>();
  });
});
