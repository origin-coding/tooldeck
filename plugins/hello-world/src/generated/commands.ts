// This file is generated from manifest.json. Do not edit it by hand.

export interface HelloWorldInput {
  [k: string]: unknown;
}

export interface PluginCommandInputs {
  "hello.world": HelloWorldInput;
}

export type PluginCommandId = keyof PluginCommandInputs;

export type PluginCommandInput<TCommandId extends PluginCommandId> =
  PluginCommandInputs[TCommandId];

export const commandIds = {
  helloWorld: "hello.world",
} as const;
