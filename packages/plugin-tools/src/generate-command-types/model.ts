import type { PluginManifest, TooldeckInputJsonSchema } from "@tooldeck/protocol";
import { camelCase, pascalCase } from "scule";

import type { GeneratePluginCommandTypesOptions, GeneratedCommandTypesModel } from "./types";

export function createCommandTypesModel(
  manifest: PluginManifest,
  options: GeneratePluginCommandTypesOptions,
): GeneratedCommandTypesModel {
  const commands = manifest.contributes?.commands ?? [];
  const generatedCommands: GeneratedCommandTypesModel["commands"] = [];
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

export function quotePropertyName(propertyName: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)) {
    return propertyName;
  }

  return JSON.stringify(propertyName);
}

function commandInputTypeName(commandId: string): string {
  const name = pascalCase(commandId);

  return toTypeIdentifier(`${name || "Command"}Input`);
}

function commandIdConstantKey(commandId: string): string {
  return camelCase(commandId) || "command";
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
