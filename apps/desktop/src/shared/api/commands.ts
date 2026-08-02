import type {
  CommandResult,
  CommandUi,
  JsonObject,
  TooldeckInputJsonSchema,
} from "@tooldeck/protocol";

export type DesktopPluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export interface DesktopCommand {
  id: string;
  pluginId: string;
  pluginEnabled: boolean;
  pluginRuntimeState: DesktopPluginRuntimeState;
  title: string;
  description?: string;
  "x-ui"?: CommandUi;
  inputSchema?: TooldeckInputJsonSchema;
  searchText: string[];
}

export interface RunCommandRequest {
  commandId: string;
  input?: JsonObject;
  locale?: string;
}

export interface CatalogLocaleRequest {
  locale?: string;
}

export type ListCommandsRequest = CatalogLocaleRequest;

export interface DesktopCommandsApi {
  list(request?: ListCommandsRequest): Promise<DesktopCommand[]>;
  run(request: RunCommandRequest): Promise<CommandResult>;
}
