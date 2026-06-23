import { compile } from "json-schema-to-typescript";
import { camelCase, pascalCase } from "scule";

import type { PluginManifest, TooldeckInputJsonSchema } from "@tooldeck/protocol";

export interface GeneratePluginCommandTypesOptions {
  cwd?: string;
  sourceLabel?: string;
}

interface GeneratedCommandTypesModel {
  sourceLabel: string;
  commands: GeneratedCommand[];
}

interface GeneratedCommand {
  id: string;
  inputTypeName: string;
  commandIdKey: string;
  inputSchema: TooldeckInputJsonSchema;
}

type JsonSchemaToTypescriptSchema = Parameters<typeof compile>[0];

export async function generatePluginCommandTypes(
  manifest: PluginManifest,
  options: GeneratePluginCommandTypesOptions = {},
): Promise<string> {
  const model = createCommandTypesModel(manifest, options);
  const declarations = await Promise.all(
    model.commands.map((command) => renderCommandInputDeclaration(command, options)),
  );
  const mapEntries = model.commands.map(
    (command) => `  ${JSON.stringify(command.id)}: ${command.inputTypeName};`,
  );
  const commandIdEntries = model.commands.map(
    (command) => `  ${quotePropertyName(command.commandIdKey)}: ${JSON.stringify(command.id)},`,
  );

  return [
    `// This file is generated from ${model.sourceLabel}. Do not edit it by hand.`,
    "",
    ...declarations.flatMap((declaration) => [declaration, ""]),
    "export interface PluginCommandInputs {",
    ...mapEntries,
    "}",
    "",
    "export type PluginCommandId = keyof PluginCommandInputs;",
    "",
    "export type PluginCommandInput<TCommandId extends PluginCommandId> =",
    "  PluginCommandInputs[TCommandId];",
    "",
    "export const commandIds = {",
    ...commandIdEntries,
    "} as const;",
    "",
  ].join("\n");
}

function createCommandTypesModel(
  manifest: PluginManifest,
  options: GeneratePluginCommandTypesOptions,
): GeneratedCommandTypesModel {
  const commands = manifest.contributes?.commands ?? [];
  const generatedCommands: GeneratedCommand[] = [];
  const inputTypeNames = new Map<string, string>();
  const commandIdKeys = new Map<string, string>();

  for (const command of commands) {
    const inputTypeName = commandInputTypeName(command.id);
    const commandIdKey = commandIdConstantKey(command.id);
    const conflictingInputTypeName = inputTypeNames.get(inputTypeName);
    const conflictingCommandId = commandIdKeys.get(commandIdKey);

    if (conflictingCommandId) {
      throw new Error(
        `Generated commandIds key "${commandIdKey}" conflicts for command ids: ${conflictingCommandId}, ${command.id}`,
      );
    }

    if (conflictingInputTypeName) {
      throw new Error(
        `Generated input type name "${inputTypeName}" conflicts for command ids: ${conflictingInputTypeName}, ${command.id}`,
      );
    }

    inputTypeNames.set(inputTypeName, command.id);
    commandIdKeys.set(commandIdKey, command.id);
    generatedCommands.push({
      id: command.id,
      inputTypeName,
      commandIdKey,
      inputSchema: command.inputSchema ?? defaultInputSchema(),
    });
  }

  return {
    sourceLabel: options.sourceLabel ?? "manifest.json",
    commands: generatedCommands,
  };
}

function commandInputTypeName(commandId: string): string {
  const name = pascalCase(commandId);

  return toTypeIdentifier(`${name || "Command"}Input`);
}

function commandIdConstantKey(commandId: string): string {
  return camelCase(commandId) || "command";
}

async function renderCommandInputDeclaration(
  command: GeneratedCommand,
  options: GeneratePluginCommandTypesOptions,
): Promise<string> {
  const output = await compile(
    command.inputSchema as JsonSchemaToTypescriptSchema,
    command.inputTypeName,
    {
      additionalProperties: true,
      bannerComment: "",
      cwd: options.cwd,
      unknownAny: true,
    },
  );

  return output.trim();
}

function quotePropertyName(propertyName: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)) {
    return propertyName;
  }

  return JSON.stringify(propertyName);
}

function toTypeIdentifier(value: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    return value;
  }

  const sanitized = value.replaceAll(/[^A-Za-z0-9_$]/g, "");

  if (!sanitized) {
    return "CommandInput";
  }

  if (/^[A-Za-z_$]/.test(sanitized)) {
    return sanitized;
  }

  return `Command${sanitized}`;
}

function defaultInputSchema(): TooldeckInputJsonSchema {
  return {
    type: "object",
    additionalProperties: true,
  };
}
