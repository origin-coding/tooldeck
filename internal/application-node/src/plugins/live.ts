import path from "node:path";

import type { LocalizedString } from "@tooldeck/protocol";
import type { PluginScanSource } from "@tooldeck/runtime-node";
import { Effect, Exit, Layer } from "effect";

import {
  applicationErrorFromCause,
  type ApplicationEffect,
  type ApplicationFailure,
  tryApplicationSync,
} from "@/application/effect";
import { localizeApplicationPlugin } from "@/application/localization";
import { Commands, type CommandsService } from "@/commands/context";
import { ApplicationError } from "@/errors/error";
import { Plugins, type PluginsService } from "@/plugins/context";
import {
  installPluginPackage,
  listPurgeablePluginData,
  makePluginManagementContext,
  purgePluginData,
  setManagedPluginEnabled,
  uninstallPlugin,
  type PluginManagementContext,
} from "@/plugins/management";
import type {
  ApplicationInstalledPlugin,
  ApplicationPlugin,
  ApplicationPluginCatalog,
  ApplicationPluginDataResidue,
  ApplicationPluginInstall,
  ApplicationPluginLocaleRequest,
  ApplicationPluginPurgeResult,
} from "@/plugins/types";
import { Runtime, type RuntimeService } from "@/runtime/context";
import { ApplicationStorage, type ApplicationStorageService } from "@/storage/context";

export interface PluginsLiveOptions {
  readonly installedPluginsDir: string;
  readonly pluginSources: PluginScanSource[];
}

interface PluginsServiceDependencies {
  readonly runtime: RuntimeService;
  readonly getStorage: () => ApplicationEffect<ApplicationStorageService>;
  readonly management: PluginManagementContext;
  readonly commands: Pick<CommandsService, "list">;
}

export function makePluginsLive(
  options: PluginsLiveOptions,
): Layer.Layer<Plugins, ApplicationFailure, Runtime | ApplicationStorage | Commands> {
  return Layer.effect(
    Plugins,
    Effect.gen(function* () {
      const runtime = yield* Runtime;
      const storage = yield* ApplicationStorage;
      const commands = yield* Commands;
      const management = yield* tryApplicationSync(() =>
        makePluginManagementContext({
          installedPluginsDir: options.installedPluginsDir,
          pluginSources: options.pluginSources,
          repositories: storage.repositories,
          withImmediateTransaction: storage.withImmediateTransaction,
        }),
      );

      return makePluginsService({
        runtime,
        getStorage: () => Effect.succeed(storage),
        management,
        commands,
      });
    }),
  );
}

function makePluginsService(dependencies: PluginsServiceDependencies): PluginsService {
  const list = (request: ApplicationPluginLocaleRequest = {}) =>
    listPlugins(dependencies, request.locale);

  const listDataResidues = (): ApplicationEffect<ApplicationPluginDataResidue[]> =>
    listPurgeablePluginData(dependencies.management);

  const createCatalog = (locale?: string): ApplicationEffect<ApplicationPluginCatalog> =>
    Effect.gen(function* () {
      const commands = yield* dependencies.commands.list({ locale });
      const plugins = yield* list({ locale });
      return { commands, plugins };
    });

  return Object.freeze({
    list,
    rescan: (request: ApplicationPluginLocaleRequest = {}) =>
      dependencies.runtime.rebuild().pipe(Effect.zipRight(createCatalog(request.locale))),
    setEnabled: (
      pluginId: string,
      enabled: boolean,
      request: ApplicationPluginLocaleRequest = {},
    ) =>
      Effect.gen(function* () {
        yield* tryApplicationSync(() => assertPluginId(pluginId, "enable or disable"));
        yield* setManagedPluginEnabled(dependencies.management, pluginId, enabled);
        yield* dependencies.runtime.rebuild();
        const plugins = yield* list(request);
        const plugin = plugins.find((candidate) => candidate.id === pluginId);

        if (!plugin) {
          return yield* Effect.fail(
            new ApplicationError({
              source: "application",
              code: "ERR_NOT_FOUND",
              message: `Plugin is not registered: ${pluginId}`,
              details: { pluginId },
            }),
          );
        }

        return plugin;
      }),
    installPackage: (packagePath: string, request: ApplicationPluginLocaleRequest = {}) =>
      Effect.gen(function* () {
        yield* tryApplicationSync(() => assertPackagePath(packagePath));
        const installed = yield* installPluginPackage(dependencies.management, packagePath);
        const refreshExit = yield* Effect.exit(dependencies.runtime.rebuild());

        if (Exit.isFailure(refreshExit)) {
          return {
            status: "installed-refresh-failed" as const,
            installedPluginId: installed.plugin.id,
            packageName: installed.install.packageName,
            install: formatPluginInstall(installed.install),
            plugin: formatInstalledPlugin(installed.plugin),
            refreshError: applicationErrorFromCause(refreshExit.cause).message,
          };
        }

        return {
          status: "installed" as const,
          installedPluginId: installed.plugin.id,
          packageName: installed.install.packageName,
          install: formatPluginInstall(installed.install),
          plugin: formatInstalledPlugin(installed.plugin),
          catalog: yield* createCatalog(request.locale),
        };
      }),
    uninstall: (pluginId: string, request: ApplicationPluginLocaleRequest = {}) =>
      Effect.gen(function* () {
        yield* tryApplicationSync(() => assertPluginId(pluginId, "uninstall"));
        yield* dependencies.runtime.dispose();
        const uninstallExit = yield* Effect.exit(
          uninstallPlugin(dependencies.management, pluginId),
        );

        if (Exit.isFailure(uninstallExit)) {
          const recoveryExit = yield* Effect.exit(dependencies.runtime.rebuild());

          if (Exit.isFailure(recoveryExit)) {
            const uninstallError = applicationErrorFromCause(uninstallExit.cause);
            const recoveryError = applicationErrorFromCause(recoveryExit.cause);

            return yield* tryApplicationSync(() => {
              throw new AggregateError(
                [uninstallError, recoveryError],
                "Plugin uninstall failed and runtime recovery did not complete.",
                { cause: uninstallError },
              );
            });
          }

          return yield* Effect.failCause(uninstallExit.cause);
        }

        yield* dependencies.runtime.rebuild();

        return {
          cleanupFailures: uninstallExit.value.cleanupFailures,
          cleanupPending: uninstallExit.value.cleanupPending,
          filesMissing: uninstallExit.value.filesMissing,
          pluginId: uninstallExit.value.pluginId,
          install: formatPluginInstall(uninstallExit.value.install),
          catalog: yield* createCatalog(request.locale),
          residues: yield* listDataResidues(),
        };
      }),
    listDataResidues,
    purgeData: (pluginId: string): ApplicationEffect<ApplicationPluginPurgeResult> =>
      Effect.gen(function* () {
        yield* tryApplicationSync(() => assertPluginId(pluginId, "purge data for"));
        const purged = yield* purgePluginData(dependencies.management, pluginId);
        return { ...purged, residues: yield* listDataResidues() };
      }),
  });
}

function listPlugins(
  dependencies: PluginsServiceDependencies,
  locale?: string,
): ApplicationEffect<ApplicationPlugin[]> {
  return Effect.gen(function* () {
    const runtime = yield* dependencies.runtime.current();
    const storage = yield* dependencies.getStorage();

    return yield* tryApplicationSync(() => {
      const commandCounts = new Map<string, number>();

      for (const command of runtime.manifestIndex.listCommands()) {
        commandCounts.set(command.pluginId, (commandCounts.get(command.pluginId) ?? 0) + 1);
      }

      return storage.repositories.plugins
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
    });
  });
}

function assertPackagePath(packagePath: string): void {
  if (typeof packagePath !== "string" || !path.isAbsolute(packagePath)) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Plugin installation requires an absolute package path.",
    });
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
