import { mkdir } from "node:fs/promises";

import { createRuntime } from "@tooldeck/runtime-node";
import { Cause, Context, Effect, ExecutionStrategy, Exit, Layer, Scope } from "effect";

import type { ApplicationConfiguration } from "@/application/configuration";
import { normalizeApplicationConfiguration } from "@/application/configuration";
import {
  applicationErrorFromCause,
  type ApplicationEffect,
  type ApplicationFailure,
  runApplicationEffect,
  tryApplicationPromise,
} from "@/application/effect";
import {
  ApplicationLifecycleCoordinator,
  type ApplicationLifecycleResources,
} from "@/application/lifecycle";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { Commands } from "@/commands/context";
import { makeCommandsLive } from "@/commands/live";
import type { ApplicationCommandFacade } from "@/commands/types";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/cleanup";
import { ApplicationError } from "@/errors/error";
import { History } from "@/history/context";
import { makeHistoryLive } from "@/history/live";
import type { ApplicationHistoryFacade } from "@/history/types";
import { Plugins } from "@/plugins/context";
import { makePluginsLive } from "@/plugins/live";
import { syncPluginRepository } from "@/plugins/management/catalog";
import type { ApplicationPluginFacade } from "@/plugins/types";
import { Preferences } from "@/preferences/context";
import { makePreferencesLive } from "@/preferences/live";
import type { ApplicationPreferenceFacade } from "@/preferences/types";
import { makeRuntimeLive } from "@/runtime/live";
import { ApplicationStorage } from "@/storage/context";
import { makeStorageLive } from "@/storage/live";
import type { PluginKvRepository } from "@/storage/repositories";

type ApplicationServices = Commands | Plugins | Preferences | History;

interface ApplicationFacades {
  readonly commands: ApplicationCommandFacade;
  readonly plugins: ApplicationPluginFacade;
  readonly preferences: ApplicationPreferenceFacade;
  readonly history: ApplicationHistoryFacade;
}

export function composeTooldeckApplication(options: CreateTooldeckApplicationOptions = {}): {
  readonly configuration: ApplicationConfiguration;
  readonly lifecycle: ApplicationLifecycleCoordinator;
  readonly facades: ApplicationFacades;
} {
  const configuration = normalizeApplicationConfiguration(options);
  const owner = new ApplicationGraphOwner((onCleanupFailure) =>
    makeApplicationLayer(configuration, onCleanupFailure),
  );

  return {
    configuration,
    lifecycle: new ApplicationLifecycleCoordinator(owner),
    facades: createApplicationFacades(owner),
  };
}

class ApplicationGraphOwner implements ApplicationLifecycleResources {
  private context?: Context.Context<ApplicationServices>;
  private scope?: Scope.CloseableScope;
  private closed = false;
  private readonly cleanupFailures: CapturedApplicationCleanupFailure[] = [];

  constructor(
    private readonly makeLayer: (
      onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
    ) => Layer.Layer<ApplicationServices, ApplicationFailure>,
  ) {}

  acquire(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationGraphOwner) {
      const scope = yield* Scope.make(ExecutionStrategy.sequential);
      this.scope = scope;
      this.cleanupFailures.length = 0;
      this.context = yield* Layer.buildWithScope(
        this.makeLayer((failure) => this.cleanupFailures.push(failure)),
        scope,
      );
    });
  }

  rollbackFailedStart(cause: Cause.Cause<ApplicationFailure>): ApplicationEffect<never> {
    return Effect.gen(this, function* (this: ApplicationGraphOwner) {
      const primaryError = applicationErrorFromCause(cause);
      const scope = this.scope;
      this.clear();

      if (scope) {
        yield* Scope.close(scope, Exit.failCause(cause));
      }

      const cleanupFailures = this.takeCleanupFailures();

      if (cleanupFailures.length > 0) {
        const cleanupError = createApplicationCleanupError(
          "Application resource cleanup failed.",
          cleanupFailures,
        );

        return yield* Effect.fail(
          combinePrimaryAndCleanupFailures(
            primaryError,
            [
              captureApplicationCleanupFailure({
                phase: "cleanup",
                step: "applicationResources.dispose",
                context: {},
                error: cleanupError,
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
    return Effect.gen(this, function* (this: ApplicationGraphOwner) {
      const scope = this.scope;
      this.clear();
      this.closed = true;

      if (scope) {
        yield* Scope.close(scope, Exit.succeed(undefined));
      }

      const cleanupFailures = this.takeCleanupFailures();

      if (cleanupFailures.length > 0) {
        return yield* Effect.fail(
          createApplicationCleanupError("Application resource cleanup failed.", cleanupFailures),
        );
      }
    });
  }

  run<I extends ApplicationServices, S, A>(
    tag: Context.Tag<I, S>,
    resourceName: string,
    operation: (service: S) => ApplicationEffect<A>,
  ): Promise<A> {
    return runApplicationEffect(
      Effect.suspend(() => {
        if (!this.context) {
          return Effect.fail(this.unavailableError(resourceName));
        }

        return operation(Context.get(this.context, tag));
      }),
    );
  }

  private clear(): void {
    this.context = undefined;
    this.scope = undefined;
  }

  private takeCleanupFailures(): CapturedApplicationCleanupFailure[] {
    return this.cleanupFailures.splice(0);
  }

  private unavailableError(resourceName: string): ApplicationError {
    return new ApplicationError({
      source: "application",
      code: this.closed ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
      message: this.closed
        ? `Tooldeck application ${resourceName} is unavailable after disposal.`
        : `Tooldeck application ${resourceName} is unavailable before start.`,
    });
  }
}

function makeApplicationLayer(
  configuration: ApplicationConfiguration,
  onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
): Layer.Layer<ApplicationServices, ApplicationFailure> {
  const storage = makeStorageLive({
    path: configuration.paths.databasePath,
    onCleanupFailure,
  });
  const runtime = makeRuntimeLayer(configuration, onCleanupFailure).pipe(Layer.provide(storage));
  const infrastructure = Layer.merge(storage, runtime);
  const commands = makeCommandsLive({
    preprocessInput: configuration.preprocessCommandInput,
  }).pipe(Layer.provide(infrastructure));
  const preferences = makePreferencesLive().pipe(Layer.provide(infrastructure));
  const history = makeHistoryLive().pipe(Layer.provide(infrastructure));
  const plugins = makePluginsLive({
    installedPluginsDir: configuration.paths.installedPluginsDir,
    pluginSources: configuration.pluginSources,
  }).pipe(Layer.provide(Layer.merge(infrastructure, commands)));

  return Layer.mergeAll(commands, plugins, preferences, history);
}

function makeRuntimeLayer(
  configuration: ApplicationConfiguration,
  onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
) {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const storage = yield* ApplicationStorage;

      return makeRuntimeLive({
        createRuntime: () =>
          Effect.gen(function* () {
            yield* tryApplicationPromise(async () => {
              await mkdir(configuration.paths.installedPluginsDir, { recursive: true });
              await mkdir(configuration.paths.userPluginsDir, { recursive: true });
            });

            return yield* createRuntime({
              pluginSources: configuration.pluginSources,
              coercion: configuration.commandInputCoercion,
              createPluginStorage: (pluginId) =>
                createPluginStorage(storage.repositories.pluginKv, pluginId),
              afterScan({ manifestIndex }) {
                syncPluginRepository(storage.repositories.plugins, manifestIndex);
              },
            });
          }),
        onCleanupFailure,
      });
    }),
  );
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

function createApplicationFacades(owner: ApplicationGraphOwner): ApplicationFacades {
  return {
    commands: {
      list: (request = {}) => owner.run(Commands, "runtime", (service) => service.list(request)),
      run: (request) => owner.run(Commands, "runtime", (service) => service.run(request)),
    },
    plugins: {
      list: (request = {}) => owner.run(Plugins, "runtime", (service) => service.list(request)),
      rescan: (request = {}) => owner.run(Plugins, "runtime", (service) => service.rescan(request)),
      setEnabled: (pluginId, enabled, request = {}) =>
        owner.run(Plugins, "runtime", (service) => service.setEnabled(pluginId, enabled, request)),
      installPackage: (packagePath, request = {}) =>
        owner.run(Plugins, "runtime", (service) => service.installPackage(packagePath, request)),
      uninstall: (pluginId, request = {}) =>
        owner.run(Plugins, "runtime", (service) => service.uninstall(pluginId, request)),
      listDataResidues: () =>
        owner.run(Plugins, "runtime", (service) => service.listDataResidues()),
      purgeData: (pluginId) =>
        owner.run(Plugins, "runtime", (service) => service.purgeData(pluginId)),
    },
    preferences: {
      list: (request = {}) =>
        owner.run(Preferences, "preferences", (service) => service.list(request)),
      get: (request) => owner.run(Preferences, "preferences", (service) => service.get(request)),
      set: (request) => owner.run(Preferences, "preferences", (service) => service.set(request)),
      delete: (request) =>
        owner.run(Preferences, "preferences", (service) => service.delete(request)),
    },
    history: {
      listCommandRuns: (request = {}) =>
        owner.run(History, "command history", (service) => service.listCommandRuns(request)),
    },
  };
}
