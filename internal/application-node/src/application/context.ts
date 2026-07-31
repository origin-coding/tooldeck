import { mkdir } from "node:fs/promises";
import path from "node:path";

import { createRuntime, type CreatedRuntime, type PluginScanSource } from "@tooldeck/runtime-node";

import {
  identityCommandInputPreprocessor,
  type CommandInputPreprocessor,
  type TooldeckApplicationAdapters,
} from "@/application/adapters";
import type {
  ApplicationPluginSource,
  ApplicationCommandInputCoercion,
  CreateTooldeckApplicationOptions,
} from "@/application/types";
import { ApplicationError } from "@/errors/application-error";
import { combinePrimaryAndCleanupErrors } from "@/errors/application-error-composition";
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

    this.state = "starting";

    try {
      await mkdir(path.dirname(this.paths.databasePath), { recursive: true });
      await mkdir(this.paths.installedPluginsDir, { recursive: true });
      await mkdir(this.paths.userPluginsDir, { recursive: true });

      this.database = openTooldeckDatabase({ path: this.paths.databasePath });
      this.commandRuns = new CommandRunRepository(this.database.db);
      this.preferences = new PreferenceRepository(this.database.db);
      this.plugins = new PluginRepository(this.database.db);
      this.pluginKv = new PluginKvRepository(this.database.db);
      this.pluginManagement = new PluginManagementService({
        database: this.database,
        installedPluginsDir: this.paths.installedPluginsDir,
        pluginSources: this.pluginSources,
      });

      await this.rebuildRuntime();
      this.state = "started";
    } catch (error) {
      try {
        await this.disposeResources();
      } catch (cleanupError) {
        this.state = "created";
        throw combinePrimaryAndCleanupErrors(
          error,
          [cleanupError],
          "Application startup failed and partial resources could not be fully released.",
        );
      }

      this.state = "created";
      throw error;
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
    const runtime = await createRuntime({
      pluginSources: this.pluginSources,
      coercion: this.commandInputCoercion,
      createPluginStorage(pluginId) {
        return {
          async get(key) {
            return pluginKv.get(pluginId, key);
          },
          async set(key, value) {
            pluginKv.set({ pluginId, key, value });
          },
          async delete(key) {
            pluginKv.delete(pluginId, key);
          },
        };
      },
      afterScan({ manifestIndex }) {
        pluginManagement.syncCatalog(manifestIndex);
      },
    });

    this.runtime = runtime;
  }

  async disposeRuntime(): Promise<void> {
    const runtime = this.runtime;
    this.runtime = undefined;
    await runtime?.dispose();
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

  private async disposeResources(): Promise<void> {
    const failures: unknown[] = [];

    try {
      await this.disposeRuntime();
    } catch (error) {
      failures.push(error);
    }

    const database = this.database;
    this.database = undefined;
    this.commandRuns = undefined;
    this.preferences = undefined;
    this.plugins = undefined;
    this.pluginKv = undefined;
    this.pluginManagement = undefined;

    try {
      database?.close();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length === 1) {
      throw failures[0];
    }

    if (failures.length > 1) {
      throw combinePrimaryAndCleanupErrors(
        failures[0],
        failures.slice(1),
        "Application resource cleanup failed.",
      );
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
