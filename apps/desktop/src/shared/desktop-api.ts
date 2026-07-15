import type { PreferenceScope } from "@tooldeck/preferences";
import type { CommandResult, CommandUi, TooldeckInputJsonSchema } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";

export type DesktopPluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export type DesktopPluginSourceKind = "builtin" | "installed" | "external";

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

export interface DesktopPlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  manifestPath: string;
  sourceKind: DesktopPluginSourceKind;
  enabled: boolean;
  runtimeState: DesktopPluginRuntimeState;
  commandCount: number;
  updatedAt: number;
  searchText: string[];
}

export interface CommandRunRecord {
  id: string;
  commandId: string;
  pluginId?: string;
  source: string;
  status: CommandResult["status"];
  input?: unknown;
  output?: CommandResult;
  error?: unknown;
  durationMs?: number;
  createdAt: number;
}

export interface DesktopPreference {
  scope: PreferenceScope;
  key: string;
  value: unknown;
  defaultValue: unknown;
  description: string;
  valueType: "boolean" | "enum";
  values?: readonly string[];
  updatedAt?: number;
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

export type ListPluginsRequest = CatalogLocaleRequest;

export type RescanPluginsRequest = CatalogLocaleRequest;

export interface ListCommandRunsRequest {
  limit?: number;
  commandId?: string;
}

export interface SetPreferenceRequest {
  scope: PreferenceScope;
  key: string;
  value: unknown;
}

export interface GetPreferenceRequest {
  scope: PreferenceScope;
  key: string;
}

export interface SetPluginEnabledRequest {
  pluginId: string;
  enabled: boolean;
}

export interface InstallPluginPackageIpcRequest extends CatalogLocaleRequest {
  packagePath: string;
}

export interface InstalledDesktopPluginResult {
  status: "installed";
  installedPluginId: string;
  packageName: string;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
}

export interface InstalledDesktopPluginRefreshFailedResult {
  status: "installed-refresh-failed";
  installedPluginId: string;
  packageName: string;
  refreshError: string;
}

export type DesktopPluginInstallResult =
  | InstalledDesktopPluginResult
  | InstalledDesktopPluginRefreshFailedResult;

export interface DesktopApi {
  listCommands(request?: ListCommandsRequest): Promise<DesktopCommand[]>;
  listPlugins(request?: ListPluginsRequest): Promise<DesktopPlugin[]>;
  listPreferences(): Promise<DesktopPreference[]>;
  getPreference(request: GetPreferenceRequest): Promise<DesktopPreference>;
  setPreference(request: SetPreferenceRequest): Promise<DesktopPreference>;
  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
  installDroppedPluginPackage(
    file: File,
    request?: CatalogLocaleRequest,
  ): Promise<DesktopPluginInstallResult>;
  rescanPlugins(request?: RescanPluginsRequest): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
  runCommand(request: RunCommandRequest): Promise<CommandResult>;
  listCommandRuns(request?: ListCommandRunsRequest): Promise<CommandRunRecord[]>;
}

export const desktopIpcChannels = {
  listCommands: "tooldeck:list-commands",
  listPlugins: "tooldeck:list-plugins",
  listPreferences: "tooldeck:list-preferences",
  getPreference: "tooldeck:get-preference",
  setPreference: "tooldeck:set-preference",
  setPluginEnabled: "tooldeck:set-plugin-enabled",
  installPluginPackage: "tooldeck:install-plugin-package",
  rescanPlugins: "tooldeck:rescan-plugins",
  runCommand: "tooldeck:run-command",
  listCommandRuns: "tooldeck:list-command-runs",
} as const;
