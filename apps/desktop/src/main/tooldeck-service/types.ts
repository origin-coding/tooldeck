import type { CommandResult } from "@tooldeck/protocol";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPreference,
  DesktopPlugin,
  GetPreferenceRequest,
  ListCommandRunsRequest,
  RunCommandRequest,
  SetPreferenceRequest,
  SetPluginEnabledRequest,
} from "@/shared/desktop-api";

export interface TooldeckDesktopServiceOptions {
  workspaceRoot?: string;
  pluginsRoot?: string;
  storagePath?: string;
}

export interface DesktopLifecycleService {
  start(): Promise<void>;
  dispose(): Promise<void>;
}

export interface DesktopCatalogService {
  listCommands(): DesktopCommand[];
  listPlugins(): DesktopPlugin[];
  rescanPlugins(): Promise<{
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
