import {
  createTooldeckJsonSchemaEngine,
  prefixJsonSchemaError,
  type JsonSchemaCompilationResult,
  type JsonSchemaError,
  type JsonSchemaValidationError,
  type TooldeckJsonSchemaEngine,
  type TooldeckJsonSchemaValidator,
} from "@tooldeck/json-schema";
import type {
  CommandDefinition,
  CommandResult,
  JsonObject,
  PluginManifest,
  TooldeckInputJsonSchema,
} from "@tooldeck/protocol";

import { type CommandInputCoercion, type CommandInputContext } from "@/commands/input";
import { RuntimeError } from "@/errors/error";

const defaultInputSchema: TooldeckInputJsonSchema = {
  type: "object",
};

export interface RuntimeCommandSchemaValidators {
  strictInput: TooldeckJsonSchemaValidator<JsonObject>;
  cliInput: TooldeckJsonSchemaValidator<JsonObject>;
  output?: TooldeckJsonSchemaValidator<CommandResult>;
}

/** Runtime-owned adapter over the public, Ajv-independent JSON Schema contracts. */
export class RuntimeJsonSchema {
  private readonly engine: TooldeckJsonSchemaEngine;
  private readonly manifestValidator: TooldeckJsonSchemaValidator<PluginManifest>;
  private readonly defaultStrictInput: TooldeckJsonSchemaValidator<JsonObject>;
  private readonly defaultCliInput: TooldeckJsonSchemaValidator<JsonObject>;

  constructor(engine: TooldeckJsonSchemaEngine = createTooldeckJsonSchemaEngine()) {
    this.engine = engine;
    this.manifestValidator = requireBuiltinCompilation(engine.compileManifest(), "manifest-v1");
    this.defaultStrictInput = requireBuiltinCompilation(
      engine.compileCommandInput(defaultInputSchema, "strict"),
      "default strict command input",
    );
    this.defaultCliInput = requireBuiltinCompilation(
      engine.compileCommandInput(defaultInputSchema, "cli"),
      "default CLI command input",
    );
  }

  validateManifest(manifest: unknown, manifestPath?: string): PluginManifest {
    const result = this.manifestValidator.validate(manifest);

    if (result.valid) {
      return result.value;
    }

    throwInvalidManifest(result.error, manifestPath);
  }

  compileCommand(
    command: CommandDefinition,
    commandIndex: number,
    manifestPath?: string,
  ): RuntimeCommandSchemaValidators {
    const strictInput = command.inputSchema
      ? requireCommandCompilation(
          this.engine.compileCommandInput(command.inputSchema, "strict"),
          commandIndex,
          "inputSchema",
          manifestPath,
        )
      : this.defaultStrictInput;
    const cliInput = command.inputSchema
      ? requireCommandCompilation(
          this.engine.compileCommandInput(command.inputSchema, "cli"),
          commandIndex,
          "inputSchema",
          manifestPath,
        )
      : this.defaultCliInput;
    const output = command.outputSchema
      ? requireCommandCompilation(
          this.engine.compileCommandOutput(command.outputSchema),
          commandIndex,
          "outputSchema",
          manifestPath,
        )
      : undefined;

    return {
      strictInput,
      cliInput,
      ...(output ? { output } : {}),
    };
  }

  normalizeCommandInput(options: {
    validators: RuntimeCommandSchemaValidators;
    input: unknown;
    commandId?: string;
    coercion: CommandInputCoercion;
  }): JsonObject {
    const validator =
      options.coercion === "cli" ? options.validators.cliInput : options.validators.strictInput;
    const result = validator.validate(options.input);

    if (result.valid) {
      return result.value;
    }

    const context: CommandInputContext = {
      commandId: options.commandId,
      coercion: options.coercion,
    };

    throwCommandInputValidationError({ error: result.error, context });
  }

  validateCommandOutput(options: {
    validator: TooldeckJsonSchemaValidator<CommandResult> | undefined;
    result: CommandResult;
    commandId: string;
  }): void {
    if (!options.validator) {
      return;
    }

    const validation = options.validator.validate(options.result);

    if (validation.valid) {
      return;
    }

    throw new RuntimeError({
      code: "ERR_COMMAND_FAILED",
      message: `Command output does not match outputSchema for ${options.commandId}`,
      details: {
        issue: "invalid_command_output",
        commandId: options.commandId,
        schemaError: validation.error,
      },
    });
  }
}

function requireBuiltinCompilation<T>(
  compilation: JsonSchemaCompilationResult<T>,
  schemaName: string,
): TooldeckJsonSchemaValidator<T> {
  if (compilation.compiled) {
    return compilation.validator;
  }

  throw new RuntimeError({
    code: "ERR_INVALID_ARGUMENT",
    message: `Tooldeck JSON Schema could not compile ${schemaName}`,
    details: {
      schemaName,
      schemaError: compilation.error,
    },
  });
}

function requireCommandCompilation<T>(
  compilation: JsonSchemaCompilationResult<T>,
  commandIndex: number,
  schemaField: "inputSchema" | "outputSchema",
  manifestPath: string | undefined,
): TooldeckJsonSchemaValidator<T> {
  if (compilation.compiled) {
    return compilation.validator;
  }

  const error = prefixJsonSchemaError(compilation.error, {
    instancePath: `/contributes/commands/${commandIndex}/${schemaField}`,
    propertyPath: `contributes.commands[${commandIndex}].${schemaField}`,
  });

  throwInvalidManifest(error, manifestPath);
}

function throwInvalidManifest(error: JsonSchemaError, manifestPath: string | undefined): never {
  throw new RuntimeError({
    code: "ERR_INVALID_ARGUMENT",
    message: formatManifestErrorMessage("Invalid plugin manifest", manifestPath),
    details: {
      manifestPath: manifestPath ?? null,
      schemaError: error,
    },
  });
}

function throwCommandInputValidationError(options: {
  error: JsonSchemaValidationError;
  context: CommandInputContext;
}): never {
  throw new RuntimeError({
    code: "ERR_INVALID_ARGUMENT",
    message: options.context.commandId
      ? `Invalid command input for ${options.context.commandId}`
      : "Invalid command input",
    details: {
      issue: "invalid_command_input",
      commandId: options.context.commandId ?? null,
      schemaError: options.error,
    },
  });
}

function formatManifestErrorMessage(message: string, manifestPath: string | undefined): string {
  return manifestPath ? `${message}: ${manifestPath}` : message;
}
