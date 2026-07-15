import path from "node:path";

import type {
  DesktopCommand,
  DesktopPlugin,
  DesktopPluginDataResidue,
  DesktopPluginInstallResult,
  DesktopPluginPurgeResult,
  DesktopPluginUninstallResult,
  InstallPluginPackageIpcRequest,
  ListCommandsRequest,
  ListPluginsRequest,
  PurgePluginDataRequest,
  RescanPluginsRequest,
  SetPluginEnabledRequest,
  UninstallPluginRequest,
} from "@/shared/desktop-api";

import { TooldeckDesktopServiceContext } from "./context";
import { formatDesktopCommand, formatDesktopPlugin } from "./formatters";
import { TooldeckDesktopRuntimeService } from "./runtime";
import type { DesktopCatalogService } from "./types";

export class TooldeckDesktopCatalogService implements DesktopCatalogService {
  constructor(
    private readonly context: TooldeckDesktopServiceContext,
    private readonly runtime: TooldeckDesktopRuntimeService,
  ) {}

  listCommands(request: ListCommandsRequest = {}): DesktopCommand[] {
    const plugins = this.context.requirePlugins();
    const pluginManager = this.context.requirePluginManager();
    const manifestIndex = this.context.requireManifestIndex();

    return manifestIndex.listCommands().map((command) =>
      formatDesktopCommand({
        command,
        indexedPlugin: manifestIndex.getPlugin(command.pluginId),
        plugin: plugins.getById(command.pluginId),
        pluginManager,
        locale: request.locale,
      }),
    );
  }

  listPlugins(request: ListPluginsRequest = {}): DesktopPlugin[] {
    const manifestIndex = this.context.requireManifestIndex();
    const pluginManager = this.context.requirePluginManager();

    return this.context
      .requirePlugins()
      .list()
      .filter((plugin) => manifestIndex.getPlugin(plugin.id))
      .map((plugin) =>
        formatDesktopPlugin({
          plugin,
          indexedPlugin: manifestIndex.getPlugin(plugin.id),
          commandCount: manifestIndex
            .listCommands()
            .filter((command) => command.pluginId === plugin.id).length,
          pluginManager,
          locale: request.locale,
        }),
      );
  }

  listPluginDataResidues(): DesktopPluginDataResidue[] {
    return this.context.requirePluginManagement().listPurgeablePluginData();
  }

  async rescanPlugins(request: RescanPluginsRequest = {}): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }> {
    await this.runtime.scanAndCreateRuntime();

    return {
      commands: this.listCommands(request),
      plugins: this.listPlugins(request),
    };
  }

  async setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin> {
    await this.context.requirePluginManagement().setEnabled(request.pluginId, request.enabled);

    await this.runtime.scanAndCreateRuntime();

    const updatedPlugin = this.context.requirePlugins().getById(request.pluginId);

    if (!updatedPlugin) {
      throw new Error(`Plugin is not registered: ${request.pluginId}`);
    }

    const manifestIndex = this.context.requireManifestIndex();

    return formatDesktopPlugin({
      plugin: updatedPlugin,
      indexedPlugin: manifestIndex.getPlugin(updatedPlugin.id),
      commandCount: manifestIndex
        .listCommands()
        .filter((command) => command.pluginId === updatedPlugin.id).length,
      pluginManager: this.context.requirePluginManager(),
    });
  }

  async installPluginPackage(
    request: InstallPluginPackageIpcRequest,
  ): Promise<DesktopPluginInstallResult> {
    if (
      !request ||
      typeof request.packagePath !== "string" ||
      !path.isAbsolute(request.packagePath)
    ) {
      throw new Error("Desktop plugin installation requires an absolute package path.");
    }

    const installed = await this.context
      .requirePluginManagement()
      .installPackage(request.packagePath);

    try {
      await this.runtime.scanAndCreateRuntime();
    } catch (error) {
      return {
        status: "installed-refresh-failed",
        installedPluginId: installed.plugin.id,
        packageName: installed.install.packageName,
        refreshError: getErrorMessage(error),
      };
    }

    return {
      status: "installed",
      installedPluginId: installed.plugin.id,
      packageName: installed.install.packageName,
      commands: this.listCommands(request),
      plugins: this.listPlugins(request),
    };
  }

  async uninstallPlugin(request: UninstallPluginRequest): Promise<DesktopPluginUninstallResult> {
    assertPluginIdRequest(request, "uninstall");

    await this.runtime.disposePluginRuntime();

    let uninstalled;

    try {
      uninstalled = await this.context.requirePluginManagement().uninstall(request.pluginId);
    } catch (error) {
      try {
        await this.runtime.scanAndCreateRuntime();
      } catch (recoveryError) {
        throw new AggregateError(
          [error, recoveryError],
          "Desktop plugin uninstall failed and runtime recovery did not complete.",
          { cause: error },
        );
      }

      throw error;
    }

    await this.runtime.scanAndCreateRuntime();

    return {
      ...(uninstalled.cleanupError ? { cleanupError: uninstalled.cleanupError } : {}),
      cleanupPending: uninstalled.cleanupPending,
      commands: this.listCommands(request),
      filesMissing: uninstalled.filesMissing,
      pluginId: uninstalled.pluginId,
      plugins: this.listPlugins(request),
      residues: this.listPluginDataResidues(),
    };
  }

  purgePluginData(request: PurgePluginDataRequest): DesktopPluginPurgeResult {
    assertPluginIdRequest(request, "purge");

    const purged = this.context.requirePluginManagement().purge(request.pluginId);

    return {
      ...purged,
      residues: this.listPluginDataResidues(),
    };
  }
}

function assertPluginIdRequest(
  request: { pluginId?: unknown } | undefined,
  operation: string,
): asserts request is { pluginId: string } {
  if (!request || typeof request.pluginId !== "string" || request.pluginId.length === 0) {
    throw new Error(`Desktop plugin ${operation} requires a plugin id.`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
