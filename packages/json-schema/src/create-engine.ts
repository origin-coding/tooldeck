import {
  commandInputSchemaProfileV1Id,
  commandInputV1Schema,
  commandOutputSchemaProfileV1Id,
  commandOutputV1Schema,
  manifestV1Schema,
  type CommandResult,
  type JsonObject,
  type PluginManifest,
  type TooldeckInputJsonSchema,
  type TooldeckOutputJsonSchema,
} from "@tooldeck/protocol";
import type { ValidateFunction } from "ajv";

import type { JsonSchemaCompilationResult, JsonSchemaDocument, JsonSchemaIssue } from "./contracts";
import type { TooldeckJsonSchemaEngine } from "./engine";
import {
  createInputAjv,
  createOutputAjv,
  createProfileAjv,
  createStaticDraft07Ajv,
} from "./internal/ajv";
import { collectSchemaCompilationIssues } from "./internal/compilation-issues";
import {
  compilationError,
  compiledValidator,
  compileWithAjv,
  validateSchemaProfile,
} from "./internal/compile";
import { normalizeCommandInputSchema } from "./internal/input-schema";
import { compareIssues, createCompilationIssue, deduplicateIssues } from "./internal/issues";
import { cloneJsonValue, isJsonObject } from "./internal/json";
import {
  classifyInputProfileIssues,
  classifyManifestProfileIssues,
  classifyOutputProfileIssues,
} from "./internal/profile-issues";
import {
  collectInputSchemaSemanticIssues,
  collectManifestSemanticIssues,
} from "./internal/semantics";

interface ProtocolValidators {
  inputProfile: ValidateFunction;
  outputProfile: ValidateFunction;
  manifest: ValidateFunction<PluginManifest>;
}

type ProtocolInitialization =
  | { initialized: true; validators: ProtocolValidators }
  | { initialized: false; issues: JsonSchemaIssue[] };

export function createTooldeckJsonSchemaEngine(): TooldeckJsonSchemaEngine {
  const profileAjv = createProfileAjv();
  const strictInputAjv = createInputAjv(false);
  const cliInputAjv = createInputAjv(true);
  const outputAjv = createOutputAjv();
  const protocol = initializeProtocolValidators();
  let manifestCompilation: JsonSchemaCompilationResult<PluginManifest> | undefined;

  return {
    compileManifest() {
      manifestCompilation ??= compileManifest(protocol);
      return manifestCompilation;
    },

    compileCommandInput(schema, mode) {
      if (!protocol.initialized) {
        return initializationFailure(protocol);
      }

      return compileCommandInput(
        protocol.validators.inputProfile,
        mode === "cli" ? cliInputAjv : strictInputAjv,
        schema,
      );
    },

    compileCommandOutput(schema) {
      if (!protocol.initialized) {
        return initializationFailure(protocol);
      }

      return compileCommandOutput(protocol.validators.outputProfile, outputAjv, schema);
    },

    compileDraft07<T>(schema: JsonSchemaDocument) {
      const cloned = cloneSchemaDocument(schema);

      if (!cloned.compiled) {
        return cloned;
      }

      const compilationIssues = collectSchemaCompilationIssues(cloned.schema);

      if (compilationIssues.length > 0) {
        return { compiled: false, error: compilationError(compilationIssues) };
      }

      return compileWithAjv<T>(createStaticDraft07Ajv(), cloned.schema);
    },
  };

  function initializeProtocolValidators(): ProtocolInitialization {
    try {
      profileAjv.addSchema(commandInputV1Schema);
      profileAjv.addSchema(commandOutputV1Schema);

      const inputProfile = profileAjv.getSchema(commandInputSchemaProfileV1Id);
      const outputProfile = profileAjv.getSchema(commandOutputSchemaProfileV1Id);

      if (!inputProfile || !outputProfile) {
        return {
          initialized: false,
          issues: [createCompilationIssue(new Error("Protocol profile was not registered"))],
        };
      }

      return {
        initialized: true,
        validators: {
          inputProfile,
          outputProfile,
          manifest: profileAjv.compile<PluginManifest>(manifestV1Schema),
        },
      };
    } catch (error) {
      return { initialized: false, issues: [createCompilationIssue(error)] };
    }
  }
}

function compileManifest(
  protocol: ProtocolInitialization,
): JsonSchemaCompilationResult<PluginManifest> {
  if (!protocol.initialized) {
    return initializationFailure(protocol);
  }

  return compiledValidator(
    protocol.validators.manifest,
    collectManifestSemanticIssues,
    classifyManifestProfileIssues,
  );
}

function compileCommandInput(
  profile: ValidateFunction,
  ajv: ReturnType<typeof createInputAjv>,
  schema: TooldeckInputJsonSchema,
): JsonSchemaCompilationResult<JsonObject> {
  const cloned = cloneSchemaDocument(schema as unknown as JsonSchemaDocument);

  if (!cloned.compiled) {
    return cloned;
  }

  const profileIssues = classifyInputProfileIssues(validateSchemaProfile(profile, cloned.schema));

  if (profileIssues.length > 0) {
    return { compiled: false, error: compilationError(profileIssues) };
  }

  if (!isJsonObject(cloned.schema)) {
    return invalidSchemaRoot("Command input Schema must be an object");
  }

  const semanticIssues = deduplicateIssues(
    [
      ...collectInputSchemaSemanticIssues(cloned.schema),
      ...collectSchemaCompilationIssues(cloned.schema),
    ].sort(compareIssues),
  );

  if (semanticIssues.length > 0) {
    return { compiled: false, error: compilationError(semanticIssues) };
  }

  const normalized = normalizeCommandInputSchema(
    cloned.schema as unknown as TooldeckInputJsonSchema,
  );

  return compileWithAjv<JsonObject>(ajv, normalized);
}

function compileCommandOutput(
  profile: ValidateFunction,
  ajv: ReturnType<typeof createOutputAjv>,
  schema: TooldeckOutputJsonSchema,
): JsonSchemaCompilationResult<CommandResult> {
  const cloned = cloneSchemaDocument(schema as unknown as JsonSchemaDocument);

  if (!cloned.compiled) {
    return cloned;
  }

  const profileIssues = classifyOutputProfileIssues(validateSchemaProfile(profile, cloned.schema));

  if (profileIssues.length > 0) {
    return { compiled: false, error: compilationError(profileIssues) };
  }

  const compilationIssues = collectSchemaCompilationIssues(cloned.schema);

  if (compilationIssues.length > 0) {
    return { compiled: false, error: compilationError(compilationIssues) };
  }

  return compileWithAjv<CommandResult>(ajv, cloned.schema);
}

function cloneSchemaDocument(
  schema: JsonSchemaDocument,
):
  | { compiled: true; schema: JsonSchemaDocument }
  | Extract<JsonSchemaCompilationResult<never>, { compiled: false }> {
  const cloned = cloneJsonValue(schema);

  if (!cloned.valid) {
    return { compiled: false, error: compilationError(cloned.error.issues) };
  }

  if (typeof cloned.value === "boolean" || isJsonObject(cloned.value)) {
    return { compiled: true, schema: cloned.value };
  }

  return invalidSchemaRoot("JSON Schema must be an object or boolean");
}

function invalidSchemaRoot(
  message: string,
): Extract<JsonSchemaCompilationResult<never>, { compiled: false }> {
  return {
    compiled: false,
    error: compilationError([
      {
        code: "schema.invalid-root",
        instancePath: "",
        propertyPath: "",
        keyword: "schema",
        message,
        expected: ["object", "boolean"],
      },
    ]),
  };
}

function initializationFailure<T>(
  initialization: Extract<ProtocolInitialization, { initialized: false }>,
): JsonSchemaCompilationResult<T> {
  return { compiled: false, error: compilationError(initialization.issues) };
}
