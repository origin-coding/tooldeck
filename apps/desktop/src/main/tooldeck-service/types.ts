import type { PluginScanSource } from "@tooldeck/core";
import type { CommandResult } from "@tooldeck/protocol";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPreference,
  DesktopPlugin,
  GetPreferenceRequest,
  ListCommandsRequest,
  ListCommandRunsRequest,
  ListPluginsRequest,
  RescanPluginsRequest,
  RunCommandRequest,
  SetPreferenceRequest,
  SetPluginEnabledRequest,
} from "@/shared/desktop-api";

export interface TooldeckDesktopServiceOptions {
  workspaceRoot?: string;
  pluginsRoot?: string;
  pluginDirs?: string[];
  pluginSources?: PluginScanSource[];
  storagePath?: string;
}

export interface DesktopLifecycleService {
  start(): Promise<void>;
  dispose(): Promise<void>;
}

export interface DesktopCatalogService {
  listCommands(request?: ListCommandsRequest): DesktopCommand[];
  listPlugins(request?: ListPluginsRequest): DesktopPlugin[];
  rescanPlugins(request?: RescanPluginsRequest): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
}

export interface DesktopPreferenceService {
  listPreferences(): DesktopPreference[];
  getPreference(request: GetPreferenceRequest): DesktopPreference;
  setPreference(request: SetPreferenceRequest): DesktopPreference;
}

export interface DesktopCommandRunService {
  runCommand(request: RunCommandRequest): Promise<CommandResult>;
  listCommandRuns(request?: ListCommandRunsRequest): CommandRunRecord[];
}

export type TooldeckDesktopServiceFacade = DesktopLifecycleService &
  DesktopCatalogService &
  DesktopPreferenceService &
  DesktopCommandRunService;
