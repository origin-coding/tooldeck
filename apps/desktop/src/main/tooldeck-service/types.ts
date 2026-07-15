import type { CommandResult } from "@tooldeck/protocol";
import type { PluginScanSource } from "@tooldeck/runtime-node";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPreference,
  DesktopPlugin,
  DesktopPluginDataResidue,
  DesktopPluginInstallResult,
  DesktopPluginPurgeResult,
  DesktopPluginUninstallResult,
  GetPreferenceRequest,
  InstallPluginPackageIpcRequest,
  ListCommandsRequest,
  ListCommandRunsRequest,
  ListPluginsRequest,
  PurgePluginDataRequest,
  RescanPluginsRequest,
  RunCommandRequest,
  SetPreferenceRequest,
  SetPluginEnabledRequest,
  UninstallPluginRequest,
} from "@/shared/desktop-api";

export interface TooldeckDesktopServiceOptions {
  workspaceRoot?: string;
  pluginsRoot?: string;
  pluginDirs?: string[];
  pluginSources?: PluginScanSource[];
  installedPluginsDir?: string;
  storagePath?: string;
}

export interface DesktopLifecycleService {
  start(): Promise<void>;
  dispose(): Promise<void>;
}

export interface DesktopCatalogService {
  listCommands(request?: ListCommandsRequest): DesktopCommand[];
  listPlugins(request?: ListPluginsRequest): DesktopPlugin[];
  listPluginDataResidues(): DesktopPluginDataResidue[];
  rescanPlugins(request?: RescanPluginsRequest): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
  installPluginPackage(
    request: InstallPluginPackageIpcRequest,
  ): Promise<DesktopPluginInstallResult>;
  uninstallPlugin(request: UninstallPluginRequest): Promise<DesktopPluginUninstallResult>;
  purgePluginData(request: PurgePluginDataRequest): DesktopPluginPurgeResult;
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
