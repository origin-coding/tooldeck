import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { CreatedRuntime } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit, type Scope } from "effect";

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
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";
import type { TooldeckPaths } from "@/paths";
import type { PluginManagementService } from "@/plugins/management";
import { openTooldeckDatabase, type TooldeckDatabase } from "@/storage";
import type { ApplicationRepositories, ApplicationStorageService } from "@/storage/context";

export interface ApplicationDatabaseServices {
  readonly repositories: ApplicationRepositories;
  readonly withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"];
  readonly pluginManagement: PluginManagementService;
}

export interface ApplicationRuntimeDependencies {
  readonly parentScope: Scope.CloseableScope;
  readonly pluginKv: ApplicationRepositories["pluginKv"];
  readonly pluginManagement: PluginManagementService;
}

interface ApplicationResourceOwnerOptions {
  readonly paths: TooldeckPaths;
  readonly createDatabaseServices: (database: TooldeckDatabase) => ApplicationDatabaseServices;
  readonly createRuntime: (
    dependencies: ApplicationRuntimeDependencies,
  ) => ApplicationEffect<CreatedRuntime>;
}

export class ApplicationResourceOwner {
  private disposed = false;
  private databaseServices?: ApplicationDatabaseServices;
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

      yield* addDatabaseFinalizer(resourceScope, database);
      this.databaseServices = yield* tryApplicationSync(() =>
        this.options.createDatabaseServices(database),
      );
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
    return this.release().pipe(
      Effect.ensuring(
        Effect.sync(() => {
          this.disposed = true;
        }),
      ),
    );
  }

  rebuildRuntime(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationResourceOwner) {
      yield* this.disposeRuntime();

      const databaseServices = yield* tryApplicationSync(() => this.requireDatabaseServices());
      const parentScope = yield* tryApplicationSync(() => this.requireResourceScope().scope);

      this.runtime = yield* this.options.createRuntime({
        parentScope,
        pluginKv: databaseServices.repositories.pluginKv,
        pluginManagement: databaseServices.pluginManagement,
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

  requirePluginManagement(): PluginManagementService {
    return this.requireResource(this.databaseServices?.pluginManagement, "plugin management");
  }

  requireStorage(): ApplicationStorageService {
    const services = this.requireDatabaseServices();

    return {
      repositories: services.repositories,
      withImmediateTransaction: services.withImmediateTransaction,
    };
  }

  private requireDatabaseServices(): ApplicationDatabaseServices {
    return this.requireResource(this.databaseServices, "database services");
  }

  private requireResourceScope(): ApplicationResourceScope {
    return this.requireResource(this.resourceScope, "resource scope");
  }

  private requireResource<T>(resource: T | undefined, name: string): T {
    if (!resource) {
      throw new ApplicationError({
        source: "application",
        code: this.disposed ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
        message: this.disposed
          ? `Tooldeck application ${name} is unavailable after disposal.`
          : `Tooldeck application ${name} is unavailable before start.`,
      });
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
    this.databaseServices = undefined;
  }
}
