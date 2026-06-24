import { compile } from "json-schema-to-typescript";

import type { PluginManifest } from "@tooldeck/protocol";

import { createCommandTypesModel, quotePropertyName } from "./model";
import { sanitizeSchemaForTypescript } from "./schema";
import type { GeneratePluginCommandTypesOptions, GeneratedCommand } from "./types";

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

async function renderCommandInputDeclaration(
  command: GeneratedCommand,
  options: GeneratePluginCommandTypesOptions,
): Promise<string> {
  const output = await compile(
    sanitizeSchemaForTypescript(command.inputSchema) as JsonSchemaToTypescriptSchema,
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

export type { GeneratePluginCommandTypesOptions } from "./types";
