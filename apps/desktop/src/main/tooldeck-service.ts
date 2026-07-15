import type { CommandResult } from "@tooldeck/protocol";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPreference,
  DesktopPlugin,
  DesktopPluginInstallResult,
  GetPreferenceRequest,
  InstallPluginPackageIpcRequest,
  ListCommandsRequest,
  ListCommandRunsRequest,
  ListPluginsRequest,
  RescanPluginsRequest,
  RunCommandRequest,
  SetPreferenceRequest,
  SetPluginEnabledRequest,
} from "@/shared/desktop-api";

import { TooldeckDesktopCatalogService } from "./tooldeck-service/catalog";
import { TooldeckDesktopCommandRunService } from "./tooldeck-service/commands";
import { TooldeckDesktopServiceContext } from "./tooldeck-service/context";
import { TooldeckDesktopPreferenceService } from "./tooldeck-service/preferences";
import { TooldeckDesktopRuntimeService } from "./tooldeck-service/runtime";
import type {
  TooldeckDesktopServiceFacade,
  TooldeckDesktopServiceOptions,
} from "./tooldeck-service/types";

export type { TooldeckDesktopServiceOptions } from "./tooldeck-service/types";

export class TooldeckDesktopService implements TooldeckDesktopServiceFacade {
  private readonly runtime: TooldeckDesktopRuntimeService;
  private readonly catalog: TooldeckDesktopCatalogService;
  private readonly preferences: TooldeckDesktopPreferenceService;
  private readonly commands: TooldeckDesktopCommandRunService;

  constructor(options: TooldeckDesktopServiceOptions = {}) {
    const context = new TooldeckDesktopServiceContext(options);

    this.runtime = new TooldeckDesktopRuntimeService(context);
    this.catalog = new TooldeckDesktopCatalogService(context, this.runtime);
    this.preferences = new TooldeckDesktopPreferenceService(context);
    this.commands = new TooldeckDesktopCommandRunService(context);
  }

  start(): Promise<void> {
    return this.runtime.start();
  }

  dispose(): Promise<void> {
    return this.runtime.dispose();
  }

  listCommands(request?: ListCommandsRequest): DesktopCommand[] {
    return this.catalog.listCommands(request);
  }

  listPlugins(request?: ListPluginsRequest): DesktopPlugin[] {
    return this.catalog.listPlugins(request);
  }

  rescanPlugins(request?: RescanPluginsRequest): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }> {
    return this.catalog.rescanPlugins(request);
  }

  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin> {
    return this.catalog.setPluginEnabled(request);
  }

  installPluginPackage(
    request: InstallPluginPackageIpcRequest,
  ): Promise<DesktopPluginInstallResult> {
    return this.catalog.installPluginPackage(request);
  }

  listPreferences(): DesktopPreference[] {
    return this.preferences.listPreferences();
  }

  getPreference(request: GetPreferenceRequest): DesktopPreference {
    return this.preferences.getPreference(request);
  }

  setPreference(request: SetPreferenceRequest): DesktopPreference {
    return this.preferences.setPreference(request);
  }

  runCommand(request: RunCommandRequest): Promise<CommandResult> {
    return this.commands.runCommand(request);
  }

  listCommandRuns(request?: ListCommandRunsRequest): CommandRunRecord[] {
    return this.commands.listCommandRuns(request);
  }
}
