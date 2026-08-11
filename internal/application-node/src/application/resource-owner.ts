import { mkdir } from "node:fs/promises";
import path from "node:path";

import { type CreatedRuntime, createRuntime, type PluginScanSource } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit } from "effect";

import { applicationErrorFromCause } from "@/application/edge";
import {
  type ApplicationEffect,
  type ApplicationFailure,
  tryApplicationPromise,
  tryApplicationSync,
} from "@/application/effect";
import {
  addDatabaseFinalizer,
  closeApplicationResourceScope,
  makeApplicationResourceScope,
  type ApplicationResourceScope,
} from "@/application/resource-scope";
import type { ApplicationCommandInputCoercion } from "@/application/types";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import type { ApplicationError } from "@/errors/application-error";
import type { TooldeckPaths } from "@/paths";
import { PluginManagementService } from "@/plugins/management";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
  type TooldeckDatabase,
} from "@/storage";

interface ApplicationResourceOwnerOptions {
  readonly paths: TooldeckPaths;
  readonly pluginSources: PluginScanSource[];
  readonly commandInputCoercion: ApplicationCommandInputCoercion;
  readonly unavailableResourceError: (name: string) => ApplicationError;
}

export class ApplicationResourceOwner {
  private database?: TooldeckDatabase;
  private commandRuns?: CommandRunRepository;
  private preferences?: PreferenceRepository;
  private plugins?: PluginRepository;
  private pluginKv?: PluginKvRepository;
  private pluginManagement?: PluginManagementService;
  private runtime?: CreatedRuntime;
  private resourceScope?: ApplicationResourceScope;

  constructor(private readonly options: ApplicationResourceOwnerOptions) {}

  acquire(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationResourceOwner) {
      const resourceScope = yield* makeApplicationResourceScope();
      this.resourceScope = resourceScope;

      yield* this.createApplicationDirectories();

      const database = yield* tryApplicationSync(() =>
        openTooldeckDatabase({ path: this.options.paths.databasePath }),
      );
      this.database = database;

      yield* addDatabaseFinalizer(resourceScope, database);
      yield* tryApplicationSync(() => this.initializeDatabaseServices(database));
      yield* this.rebuildRuntime();
    });
  }

  rollbackFailedStart(cause: Cause.Cause<ApplicationFailure>): ApplicationEffect<never> {
    return Effect.gen(this, function* (this: ApplicationResourceOwner) {
      const primaryError = applicationErrorFromCause(cause);
      const cleanupExit = yield* Effect.exit(this.release(Exit.failCause(cause)));

      if (Exit.isFailure(cleanupExit)) {
        return yield* Effect.fail(
          combinePrimaryAndCleanupFailures(
            primaryError,
            [
              captureApplicationCleanupFailure({
                phase: "cleanup",
                step: "applicationResources.dispose",
                context: {},
                error: applicationErrorFromCause(cleanupExit.cause),
              }),
            ],
            "Application startup failed and partial resources could not be fully released.",
          ),
        );
      }

      return yield* Effect.failCause(cause);
    });
  }

  dispose(): ApplicationEffect<void> {
    return this.release();
  }

  rebuildRuntime(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationResourceOwner) {
      yield* this.disposeRuntime();

      const pluginKv = yield* tryApplicationSync(() => this.requirePluginKv());
      const pluginManagement = yield* tryApplicationSync(() => this.requirePluginManagement());
      const parentScope = yield* tryApplicationSync(() => this.requireResourceScope().scope);

      this.runtime = yield* createRuntime({
        pluginSources: this.options.pluginSources,
        parentScope,
        coercion: this.options.commandInputCoercion,
        createPluginStorage: (pluginId) => createPluginStorage(pluginKv, pluginId),
        afterScan({ manifestIndex }) {
          pluginManagement.syncCatalog(manifestIndex);
        },
      });
    });
  }

  disposeRuntime(): ApplicationEffect<void> {
    const runtime = this.runtime;
    this.runtime = undefined;

    return runtime ? runtime.dispose() : Effect.void;
  }

  requireRuntime(): CreatedRuntime {
    return this.requireResource(this.runtime, "runtime");
  }

  requireCommandRuns(): CommandRunRepository {
    return this.requireResource(this.commandRuns, "command history");
  }

  requirePreferences(): PreferenceRepository {
    return this.requireResource(this.preferences, "preferences");
  }

  requirePlugins(): PluginRepository {
    return this.requireResource(this.plugins, "plugin catalog");
  }

  requirePluginManagement(): PluginManagementService {
    return this.requireResource(this.pluginManagement, "plugin management");
  }

  private requirePluginKv(): PluginKvRepository {
    return this.requireResource(this.pluginKv, "plugin storage");
  }

  private requireResourceScope(): ApplicationResourceScope {
    return this.requireResource(this.resourceScope, "resource scope");
  }

  private requireResource<T>(resource: T | undefined, name: string): T {
    if (!resource) {
      throw this.options.unavailableResourceError(name);
    }

    return resource;
  }

  private createApplicationDirectories(): ApplicationEffect<void> {
    return tryApplicationPromise(async () => {
      await mkdir(path.dirname(this.options.paths.databasePath), { recursive: true });
      await mkdir(this.options.paths.installedPluginsDir, { recursive: true });
      await mkdir(this.options.paths.userPluginsDir, { recursive: true });
    });
  }

  private initializeDatabaseServices(database: TooldeckDatabase): void {
    this.commandRuns = new CommandRunRepository(database.db);
    this.preferences = new PreferenceRepository(database.db);
    this.plugins = new PluginRepository(database.db);
    this.pluginKv = new PluginKvRepository(database.db);
    this.pluginManagement = new PluginManagementService({
      database,
      installedPluginsDir: this.options.paths.installedPluginsDir,
      pluginSources: this.options.pluginSources,
    });
  }

  private release(
    requestedExit: Exit.Exit<unknown, unknown> = Exit.succeed(undefined),
  ): ApplicationEffect<void> {
    return Effect.uninterruptible(
      Effect.gen(this, function* (this: ApplicationResourceOwner) {
        const cleanupFailures: CapturedApplicationCleanupFailure[] = [];
        let resourceExit = requestedExit;
        const runtimeExit = yield* Effect.exit(this.disposeRuntime());

        if (Exit.isFailure(runtimeExit)) {
          const runtimeError = applicationErrorFromCause(runtimeExit.cause);
          resourceExit = Exit.fail(runtimeError);
          cleanupFailures.push(
            captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "runtime.dispose",
              context: {},
              error: runtimeError,
            }),
          );
        }

        const resourceScope = this.resourceScope;
        this.clearResourceReferences();

        if (resourceScope) {
          cleanupFailures.push(
            ...(yield* closeApplicationResourceScope(resourceScope, resourceExit)),
          );
        }

        if (cleanupFailures.length > 0) {
          return yield* Effect.fail(
            createApplicationCleanupError("Application resource cleanup failed.", cleanupFailures),
          );
        }
      }),
    );
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
