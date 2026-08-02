import type { CommandDefinition, CommandResult, JsonObject } from "@tooldeck/protocol";

export type ApplicationPluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export interface ApplicationCommand {
  id: string;
  pluginId: string;
  pluginEnabled: boolean;
  pluginRuntimeState: ApplicationPluginRuntimeState;
  definition: CommandDefinition;
}

export interface ListApplicationCommandsRequest {
  locale?: string;
}

export interface RunApplicationCommandRequest {
  commandId: string;
  input?: JsonObject;
  locale?: string;
  source?: string;
  recordHistory?: boolean;
}

export interface ApplicationCommandFacade {
  list(request?: ListApplicationCommandsRequest): Promise<ApplicationCommand[]>;
  run(request: RunApplicationCommandRequest): Promise<CommandResult>;
}
