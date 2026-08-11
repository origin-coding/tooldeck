import path from "node:path";

import type { CreatedRuntime, PluginScanSource } from "@tooldeck/runtime-node";

import {
  type CommandInputPreprocessor,
  identityCommandInputPreprocessor,
  type TooldeckApplicationAdapters,
} from "@/application/adapters";
import type { ApplicationEffect } from "@/application/effect";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import { ApplicationResourceOwner } from "@/application/resource-owner";
import type {
  ApplicationCommandInputCoercion,
  ApplicationPluginSource,
  CreateTooldeckApplicationOptions,
} from "@/application/types";
import { ApplicationError } from "@/errors/application-error";
import { resolveTooldeckPaths, type TooldeckPaths } from "@/paths";
import { PluginManagementService } from "@/plugins/management";
import { CommandRunRepository, PluginRepository, PreferenceRepository } from "@/storage";

export class TooldeckApplicationContext {
  readonly paths: TooldeckPaths;
  readonly pluginSources: PluginScanSource[];
  readonly commandInputCoercion: ApplicationCommandInputCoercion;
  readonly preprocessCommandInput: CommandInputPreprocessor;

  private readonly lifecycle: ApplicationLifecycleCoordinator;
  private readonly resources: ApplicationResourceOwner;

  constructor(options: CreateTooldeckApplicationOptions = {}) {
    if (options.paths && options.pathOptions) {
      throw new ApplicationError({
        source: "application",
        code: "ERR_INVALID_ARGUMENT",
        message: "Application paths and pathOptions cannot both be provided.",
      });
    }

    this.paths = options.paths ?? resolveTooldeckPaths(options.pathOptions);
    this.pluginSources = normalizePluginSources(options.pluginSources, this.paths);
    this.commandInputCoercion = options.commandInputCoercion ?? "none";
    this.preprocessCommandInput = resolveCommandPreprocessor(options.adapters);
    this.resources = new ApplicationResourceOwner({
      paths: this.paths,
      pluginSources: this.pluginSources,
      commandInputCoercion: this.commandInputCoercion,
    });
    this.lifecycle = new ApplicationLifecycleCoordinator(this.resources);
  }

  start(): Promise<void> {
    return this.lifecycle.start();
  }

  dispose(): Promise<void> {
    return this.lifecycle.dispose();
  }

  startEffect(): ApplicationEffect<void> {
    return this.lifecycle.startEffect();
  }

  disposeEffect(): ApplicationEffect<void> {
    return this.lifecycle.disposeEffect();
  }

  rebuildRuntime(): ApplicationEffect<void> {
    return this.resources.rebuildRuntime();
  }

  disposeRuntime(): ApplicationEffect<void> {
    return this.resources.disposeRuntime();
  }

  requireRuntime(): CreatedRuntime {
    return this.resources.requireRuntime();
  }

  requireCommandRuns(): CommandRunRepository {
    return this.resources.requireCommandRuns();
  }

  requirePreferences(): PreferenceRepository {
    return this.resources.requirePreferences();
  }

  requirePlugins(): PluginRepository {
    return this.resources.requirePlugins();
  }

  requirePluginManagement(): PluginManagementService {
    return this.resources.requirePluginManagement();
  }
}

function normalizePluginSources(
  configuredSources: readonly ApplicationPluginSource[] | undefined,
  paths: TooldeckPaths,
): PluginScanSource[] {
  const sources = configuredSources ?? [
    { kind: "builtin", path: paths.builtinPluginsDir },
    { kind: "installed", path: paths.installedPluginsDir },
    { kind: "external", path: paths.userPluginsDir },
  ];
  const installedSources = sources.filter((source) => source.kind === "installed");

  if (installedSources.length > 1) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Application plugin sources may contain at most one installed source.",
    });
  }

  const installedSource = installedSources[0];

  if (
    installedSource &&
    path.resolve(installedSource.path) !== path.resolve(paths.installedPluginsDir)
  ) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Installed plugin source does not match the application installed plugins path.",
    });
  }

  return [
    ...sources.filter((source) => source.kind === "builtin"),
    installedSource ?? { kind: "installed", path: paths.installedPluginsDir },
    ...sources.filter((source) => source.kind === "external"),
  ];
}

function resolveCommandPreprocessor(
  adapters: TooldeckApplicationAdapters | undefined,
): CommandInputPreprocessor {
  return adapters?.commands?.preprocessInput ?? identityCommandInputPreprocessor;
}
