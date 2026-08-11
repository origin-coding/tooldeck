import path from "node:path";

import type { CreatedRuntime, PluginScanSource } from "@tooldeck/runtime-node";
import { Effect, Exit } from "effect";

import {
  type CommandInputPreprocessor,
  identityCommandInputPreprocessor,
  type TooldeckApplicationAdapters,
} from "@/application/adapters";
import { type ApplicationEffect, tryApplicationSync } from "@/application/effect";
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

type ApplicationLifecycleState = "created" | "starting" | "started" | "disposing" | "disposed";

export class TooldeckApplicationContext {
  readonly paths: TooldeckPaths;
  readonly pluginSources: PluginScanSource[];
  readonly commandInputCoercion: ApplicationCommandInputCoercion;
  readonly preprocessCommandInput: CommandInputPreprocessor;

  private state: ApplicationLifecycleState = "created";
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
      unavailableResourceError: (name) => this.createUnavailableResourceError(name),
    });
  }

  start(): ApplicationEffect<void> {
    return Effect.suspend(() => {
      if (this.state === "started") {
        return Effect.void;
      }

      return Effect.gen(this, function* (this: TooldeckApplicationContext) {
        yield* tryApplicationSync(() => {
          this.assertCanStart();
          this.state = "starting";
        });

        const startExit = yield* Effect.exit(this.resources.acquire());

        if (Exit.isFailure(startExit)) {
          return yield* this.resources.rollbackFailedStart(startExit.cause).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                this.state = "created";
              }),
            ),
          );
        }

        this.state = "started";
      });
    });
  }

  dispose(): ApplicationEffect<void> {
    return Effect.suspend(() => {
      if (this.state === "disposed" || this.state === "disposing") {
        return Effect.void;
      }

      this.state = "disposing";

      return this.resources.dispose().pipe(
        Effect.ensuring(
          Effect.sync(() => {
            this.state = "disposed";
          }),
        ),
      );
    });
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

  private createUnavailableResourceError(name: string): ApplicationError {
    return new ApplicationError({
      source: "application",
      code: this.state === "disposed" ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
      message:
        this.state === "disposed"
          ? `Tooldeck application ${name} is unavailable after disposal.`
          : `Tooldeck application ${name} is unavailable before start.`,
    });
  }

  private assertCanStart(): void {
    if (this.state === "disposed") {
      throw new ApplicationError({
        source: "application",
        code: "ERR_APPLICATION_DISPOSED",
        message: "Tooldeck application has already been disposed.",
      });
    }

    if (this.state !== "created") {
      throw new ApplicationError({
        source: "application",
        code: "ERR_INVALID_ARGUMENT",
        message: `Tooldeck application cannot start while it is ${this.state}.`,
      });
    }
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
