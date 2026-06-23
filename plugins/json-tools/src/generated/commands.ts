// This file is generated from manifest.json. Do not edit it by hand.

export interface JsonFormatInput {
  text: string;
  indent?: number;
}

export interface PluginCommandInputs {
  "json.format": JsonFormatInput;
}

export type PluginCommandId = keyof PluginCommandInputs;

export type PluginCommandInput<TCommandId extends PluginCommandId> =
  PluginCommandInputs[TCommandId];

export const commandIds = {
  jsonFormat: "json.format",
} as const;
