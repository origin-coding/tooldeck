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

export interface RunApplicationCommandRequest {
  commandId: string;
  input?: JsonObject;
  source?: string;
  recordHistory?: boolean;
}

export interface ApplicationCommandFacade {
  list(): Promise<ApplicationCommand[]>;
  run(request: RunApplicationCommandRequest): Promise<CommandResult>;
}
