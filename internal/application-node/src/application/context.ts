import { mkdir } from "node:fs/promises";
import path from "node:path";

import { type CreatedRuntime, createRuntime, type PluginScanSource } from "@tooldeck/runtime-node";
import { Exit } from "effect";

import {
  type CommandInputPreprocessor,
  identityCommandInputPreprocessor,
  type TooldeckApplicationAdapters,
} from "@/application/adapters";
import { runApplicationEffect, runRuntimeEffect } from "@/application/edge";
import {
  addDatabaseFinalizer,
  closeApplicationResourceScope,
  makeApplicationResourceScope,
  type ApplicationResourceScope,
} from "@/application/resource-scope";
import type {
  ApplicationCommandInputCoercion,
  ApplicationPluginSource,
  CreateTooldeckApplicationOptions,
} from "@/application/types";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";
import { resolveTooldeckPaths, type TooldeckPaths } from "@/paths";
import { PluginManagementService } from "@/plugins/management";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
  type TooldeckDatabase,
} from "@/storage";

type ApplicationLifecycleState = "created" | "starting" | "started" | "disposing" | "disposed";

export class TooldeckApplicationContext {
  readonly paths: TooldeckPaths;
  readonly pluginSources: PluginScanSource[];
  readonly commandInputCoercion: ApplicationCommandInputCoercion;
  readonly preprocessCommandInput: CommandInputPreprocessor;

  private state: ApplicationLifecycleState = "created";
  private database?: TooldeckDatabase;
  private commandRuns?: CommandRunRepository;
  private preferences?: PreferenceRepository;
  private plugins?: PluginRepository;
  private pluginKv?: PluginKvRepository;
  private pluginManagement?: PluginManagementService;
  private runtime?: CreatedRuntime;
  private resourceScope?: ApplicationResourceScope;

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
  }

  async start(): Promise<void> {
    if (this.state === "started") {
      return;
    }

    this.assertCanStart();

    this.state = "starting";

    try {
      await this.startResources();
      this.state = "started";
    } catch (error) {
      await this.failStart(error);
    }
  }

  async dispose(): Promise<void> {
    if (this.state === "disposed") {
      return;
    }

    if (this.state === "disposing") {
      return;
    }

    this.state = "disposing";

    try {
      await this.disposeResources();
    } finally {
      this.state = "disposed";
    }
  }

  async rebuildRuntime(): Promise<void> {
    await this.disposeRuntime();

    const pluginKv = this.requirePluginKv();
    const pluginManagement = this.requirePluginManagement();
    const parentScope = this.requireApplicationResourceScope().scope;

    this.runtime = await runRuntimeEffect(
      createRuntime({
        pluginSources: this.pluginSources,
        parentScope,
        coercion: this.commandInputCoercion,
        createPluginStorage: (pluginId) => createPluginStorage(pluginKv, pluginId),
        afterScan({ manifestIndex }) {
          pluginManagement.syncCatalog(manifestIndex);
        },
      }),
    );
  }

  async disposeRuntime(): Promise<void> {
    const runtime = this.runtime;
    this.runtime = undefined;
    if (runtime) {
      await runRuntimeEffect(runtime.dispose());
    }
  }

  requireRuntime(): CreatedRuntime {
    return this.requireStartedResource(this.runtime, "runtime");
  }

  requireCommandRuns(): CommandRunRepository {
    return this.requireStartedResource(this.commandRuns, "command history");
  }

  requirePreferences(): PreferenceRepository {
    return this.requireStartedResource(this.preferences, "preferences");
  }

  requirePlugins(): PluginRepository {
    return this.requireStartedResource(this.plugins, "plugin catalog");
  }

  requirePluginManagement(): PluginManagementService {
    return this.requireStartedResource(this.pluginManagement, "plugin management");
  }

  private requirePluginKv(): PluginKvRepository {
    return this.requireStartedResource(this.pluginKv, "plugin storage");
  }

  private requireApplicationResourceScope(): ApplicationResourceScope {
    return this.requireStartedResource(this.resourceScope, "resource scope");
  }

  private requireStartedResource<T>(resource: T | undefined, name: string): T {
    if (!resource) {
      throw new ApplicationError({
        source: "application",
        code:
          this.state === "disposed" ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
        message:
          this.state === "disposed"
            ? `Tooldeck application ${name} is unavailable after disposal.`
            : `Tooldeck application ${name} is unavailable before start.`,
      });
    }

    return resource;
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

  private async startResources(): Promise<void> {
    this.resourceScope = await runApplicationEffect(makeApplicationResourceScope());

    await this.createApplicationDirectories();

    const database = openTooldeckDatabase({ path: this.paths.databasePath });
    this.database = database;

    await runApplicationEffect(addDatabaseFinalizer(this.resourceScope, database));

    this.initializeDatabaseServices(database);
    await this.rebuildRuntime();
  }

  private async createApplicationDirectories(): Promise<void> {
    await mkdir(path.dirname(this.paths.databasePath), { recursive: true });
    await mkdir(this.paths.installedPluginsDir, { recursive: true });
    await mkdir(this.paths.userPluginsDir, { recursive: true });
  }

  private initializeDatabaseServices(database: TooldeckDatabase): void {
    this.commandRuns = new CommandRunRepository(database.db);
    this.preferences = new PreferenceRepository(database.db);
    this.plugins = new PluginRepository(database.db);
    this.pluginKv = new PluginKvRepository(database.db);
    this.pluginManagement = new PluginManagementService({
      database,
      installedPluginsDir: this.paths.installedPluginsDir,
      pluginSources: this.pluginSources,
    });
  }

  private async failStart(error: unknown): Promise<never> {
    try {
      await this.disposeResources(Exit.fail(error));
    } catch (cleanupError) {
      this.state = "created";
      throw combinePrimaryAndCleanupFailures(
        error,
        [
          captureApplicationCleanupFailure({
            phase: "cleanup",
            step: "applicationResources.dispose",
            context: {},
            error: cleanupError,
          }),
        ],
        "Application startup failed and partial resources could not be fully released.",
      );
    }

    this.state = "created";
    throw error;
  }

  private async disposeResources(
    requestedExit: Exit.Exit<unknown, unknown> = Exit.succeed(undefined),
  ): Promise<void> {
    const cleanupFailures: CapturedApplicationCleanupFailure[] = [];
    let resourceExit = requestedExit;

    try {
      await this.disposeRuntime();
    } catch (error) {
      resourceExit = Exit.fail(error);
      cleanupFailures.push(
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "runtime.dispose",
          context: {},
          error,
        }),
      );
    }

    const resourceScope = this.resourceScope;
    this.clearResourceReferences();

    if (resourceScope) {
      cleanupFailures.push(
        ...(await runApplicationEffect(closeApplicationResourceScope(resourceScope, resourceExit))),
      );
    }

    if (cleanupFailures.length > 0) {
      throw createApplicationCleanupError("Application resource cleanup failed.", cleanupFailures);
    }
  }

  private clearResourceReferences(): void {
    this.resourceScope = undefined;
    this.database = undefined;
    this.commandRuns = undefined;
    this.preferences = undefined;
    this.plugins = undefined;
    this.pluginKv = undefined;
    this.pluginManagement = undefined;
  }
}

function createPluginStorage(pluginKv: PluginKvRepository, pluginId: string) {
  return {
    async get(key: string) {
      return pluginKv.get(pluginId, key);
    },
    async set(key: string, value: unknown) {
      pluginKv.set({ pluginId, key, value });
    },
    async delete(key: string) {
      pluginKv.delete(pluginId, key);
    },
  };
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
