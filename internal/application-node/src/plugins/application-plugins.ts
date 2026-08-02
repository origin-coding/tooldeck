import path from "node:path";

import type { LocalizedString } from "@tooldeck/protocol";

import type { TooldeckApplicationContext } from "@/application/context";
import { runApplicationOperation } from "@/application/edge";
import { localizeApplicationPlugin } from "@/application/localization";
import type { ApplicationCommands } from "@/commands/application-commands";
import { ApplicationError } from "@/errors/application-error";
import type {
  ApplicationInstalledPlugin,
  ApplicationPlugin,
  ApplicationPluginCatalog,
  ApplicationPluginDataResidue,
  ApplicationPluginFacade,
  ApplicationPluginInstall,
  ApplicationPluginInstallResult,
  ApplicationPluginLocaleRequest,
  ApplicationPluginPurgeResult,
  ApplicationPluginUninstallResult,
} from "@/plugins/facade-types";

export class ApplicationPlugins implements ApplicationPluginFacade {
  constructor(
    private readonly context: TooldeckApplicationContext,
    private readonly commands: ApplicationCommands,
  ) {}

  list(request: ApplicationPluginLocaleRequest = {}): Promise<ApplicationPlugin[]> {
    return runApplicationOperation(() => this.listUnsafe(request.locale));
  }

  rescan(request: ApplicationPluginLocaleRequest = {}): Promise<ApplicationPluginCatalog> {
    return runApplicationOperation(async () => {
      await this.context.rebuildRuntime();
      return this.createCatalog(request.locale);
    });
  }

  setEnabled(
    pluginId: string,
    enabled: boolean,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPlugin> {
    return runApplicationOperation(async () => {
      assertPluginId(pluginId, "enable or disable");
      await this.context.requirePluginManagement().setEnabled(pluginId, enabled);
      await this.context.rebuildRuntime();

      const plugin = this.listUnsafe(request.locale).find((candidate) => candidate.id === pluginId);

      if (!plugin) {
        throw new ApplicationError({
          source: "application",
          code: "ERR_NOT_FOUND",
          message: `Plugin is not registered: ${pluginId}`,
          details: { pluginId },
        });
      }

      return plugin;
    });
  }

  installPackage(
    packagePath: string,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPluginInstallResult> {
    return runApplicationOperation(async () => {
      if (typeof packagePath !== "string" || !path.isAbsolute(packagePath)) {
        throw new ApplicationError({
          source: "application",
          code: "ERR_INVALID_ARGUMENT",
          message: "Plugin installation requires an absolute package path.",
        });
      }

      const installed = await this.context.requirePluginManagement().installPackage(packagePath);

      try {
        await this.context.rebuildRuntime();
      } catch (error) {
        return {
          status: "installed-refresh-failed",
          installedPluginId: installed.plugin.id,
          packageName: installed.install.packageName,
          install: formatPluginInstall(installed.install),
          plugin: formatInstalledPlugin(installed.plugin),
          refreshError: getErrorMessage(error),
        };
      }

      return {
        status: "installed",
        installedPluginId: installed.plugin.id,
        packageName: installed.install.packageName,
        install: formatPluginInstall(installed.install),
        plugin: formatInstalledPlugin(installed.plugin),
        catalog: await this.createCatalog(request.locale),
      };
    });
  }

  uninstall(
    pluginId: string,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPluginUninstallResult> {
    return runApplicationOperation(async () => {
      assertPluginId(pluginId, "uninstall");
      await this.context.disposeRuntime();

      let uninstalled;

      try {
        uninstalled = await this.context.requirePluginManagement().uninstall(pluginId);
      } catch (error) {
        try {
          await this.context.rebuildRuntime();
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            "Plugin uninstall failed and runtime recovery did not complete.",
            { cause: error },
          );
        }

        throw error;
      }

      await this.context.rebuildRuntime();

      return {
        ...(uninstalled.cleanupError ? { cleanupError: uninstalled.cleanupError } : {}),
        cleanupPending: uninstalled.cleanupPending,
        filesMissing: uninstalled.filesMissing,
        pluginId: uninstalled.pluginId,
        install: formatPluginInstall(uninstalled.install),
        catalog: await this.createCatalog(request.locale),
        residues: this.listDataResiduesUnsafe(),
      };
    });
  }

  listDataResidues(): Promise<ApplicationPluginDataResidue[]> {
    return runApplicationOperation(() => this.listDataResiduesUnsafe());
  }

  purgeData(pluginId: string): Promise<ApplicationPluginPurgeResult> {
    return runApplicationOperation(() => {
      assertPluginId(pluginId, "purge data for");
      const purged = this.context.requirePluginManagement().purge(pluginId);

      return {
        ...purged,
        residues: this.listDataResiduesUnsafe(),
      };
    });
  }

  private listUnsafe(locale?: string): ApplicationPlugin[] {
    const runtime = this.context.requireRuntime();
    const commandCounts = new Map<string, number>();

    for (const command of runtime.manifestIndex.listCommands()) {
      commandCounts.set(command.pluginId, (commandCounts.get(command.pluginId) ?? 0) + 1);
    }

    return this.context
      .requirePlugins()
      .list()
      .filter((plugin) => runtime.manifestIndex.hasPlugin(plugin.id))
      .map((plugin) => {
        const indexedPlugin = runtime.manifestIndex.getPlugin(plugin.id)!;

        return localizeApplicationPlugin(
          {
            id: plugin.id,
            name: parseLocalizedString(plugin.nameJson),
            ...(indexedPlugin.manifest.description
              ? { description: indexedPlugin.manifest.description }
              : {}),
            manifest: indexedPlugin.manifest,
            version: plugin.version,
            manifestPath: plugin.manifestPath,
            sourceKind: assertPluginSourceKind(plugin.sourceKind),
            enabled: plugin.enabled,
            runtimeState: runtime.pluginManager.getPluginRuntimeState(plugin.id),
            commandCount: commandCounts.get(plugin.id) ?? 0,
            updatedAt: plugin.updatedAt,
          },
          indexedPlugin,
          locale,
        );
      });
  }

  private async createCatalog(locale?: string): Promise<ApplicationPluginCatalog> {
    return {
      commands: await this.commands.list({ locale }),
      plugins: this.listUnsafe(locale),
    };
  }

  private listDataResiduesUnsafe(): ApplicationPluginDataResidue[] {
    return this.context.requirePluginManagement().listPurgeablePluginData();
  }
}

function formatPluginInstall(install: ApplicationPluginInstall): ApplicationPluginInstall {
  return {
    pluginId: install.pluginId,
    version: install.version,
    installDir: install.installDir,
    manifestPath: install.manifestPath,
    packageName: install.packageName,
    packageDigest: install.packageDigest,
    packageSizeBytes: install.packageSizeBytes,
    installedAt: install.installedAt,
    updatedAt: install.updatedAt,
  };
}

function formatInstalledPlugin(plugin: {
  id: string;
  nameJson: string;
  version: string;
  manifestPath: string;
  sourceKind: string;
  enabled: boolean;
  updatedAt: number;
}): ApplicationInstalledPlugin {
  return {
    id: plugin.id,
    name: parseLocalizedString(plugin.nameJson),
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    sourceKind: assertPluginSourceKind(plugin.sourceKind),
    enabled: plugin.enabled,
    updatedAt: plugin.updatedAt,
  };
}

function parseLocalizedString(value: string): LocalizedString {
  try {
    return JSON.parse(value) as LocalizedString;
  } catch {
    return value;
  }
}

function assertPluginSourceKind(value: string): ApplicationPlugin["sourceKind"] {
  if (value === "builtin" || value === "installed" || value === "external") {
    return value;
  }

  throw new ApplicationError({
    source: "application",
    code: "ERR_INVALID_ARGUMENT",
    message: `Unsupported plugin source kind: ${value}`,
  });
}

function assertPluginId(pluginId: string, operation: string): void {
  if (typeof pluginId !== "string" || pluginId.length === 0) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: `Plugin ${operation} operation requires a plugin id.`,
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
