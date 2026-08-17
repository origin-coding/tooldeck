import type {
  CommandResult,
  JsonObject,
  PluginManifest,
  TooldeckInputJsonSchema,
  TooldeckOutputJsonSchema,
} from "@tooldeck/protocol";

import type { JsonSchemaCompilationResult, JsonSchemaDocument } from "./contracts";

export type CommandInputValidationMode = "strict" | "cli";

/**
 * Ajv-independent compilation boundary for a caller-scoped Tooldeck JSON Schema engine.
 *
 * Implementations own their Ajv instances. Consumers own the engine and compiled validator
 * lifetime; no repository-global cache or singleton is implied by this interface.
 */
export interface TooldeckJsonSchemaEngine {
  compileManifest(): JsonSchemaCompilationResult<PluginManifest>;

  compileCommandInput(
    schema: TooldeckInputJsonSchema,
    mode: CommandInputValidationMode,
  ): JsonSchemaCompilationResult<JsonObject>;

  compileCommandOutput(
    schema: TooldeckOutputJsonSchema,
  ): JsonSchemaCompilationResult<CommandResult>;

  compileDraft07<T>(schema: JsonSchemaDocument): JsonSchemaCompilationResult<T>;
}
