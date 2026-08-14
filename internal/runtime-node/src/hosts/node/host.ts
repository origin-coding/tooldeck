import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CommandRegistry,
  PluginContextV1,
  PluginStorage,
  ToolboxPluginV1,
} from "@tooldeck/sdk-node";
import { Cause, Effect, ExecutionStrategy, Exit, Option, Scope } from "effect";

import { runtimeErrorFromCause, tryRuntimePromise, type RuntimeEffect } from "@/effect";
import {
  captureRuntimeCleanupFailure,
  combineRuntimePrimaryAndCleanupFailures,
  createRuntimeCleanupError,
  type CapturedRuntimeCleanupFailure,
} from "@/errors/cleanup";
import { RuntimeError, toRuntimeError } from "@/errors/error";
import type { PluginHost, PluginHostActivateOptions } from "@/hosts/host";

export interface NodePluginHostOptions {
  commandRegistry: CommandRegistry;
  createPluginStorage?: (pluginId: string) => PluginStorage;
  scope: Scope.CloseableScope;
}

export type ActivateNodePluginOptions = PluginHostActivateOptions;

export interface ActiveNodePlugin {
  pluginId: string;
  entryPath: string;
  plugin: ToolboxPluginV1;
  context: PluginContextV1;
}

interface ManagedActiveNodePlugin extends ActiveNodePlugin {
  scope: Scope.CloseableScope;
  cleanupFailures: CapturedRuntimeCleanupFailure[];
}

export class NodePluginHost implements PluginHost {
  readonly kind = "node";

  private readonly commandRegistry: CommandRegistry;
  private readonly createPluginStorage: (pluginId: string) => PluginStorage;
  private readonly scope: Scope.CloseableScope;
  private readonly activePlugins = new Map<string, ManagedActiveNodePlugin>();

  constructor(options: NodePluginHostOptions) {
    this.commandRegistry = options.commandRegistry;
    this.createPluginStorage = options.createPluginStorage ?? createMemoryPluginStorage;
    this.scope = options.scope;
  }

  hasPlugin(pluginId: string): boolean {
    return this.activePlugins.has(pluginId);
  }

  getPlugin(pluginId: string): ActiveNodePlugin | undefined {
    return this.activePlugins.get(pluginId);
  }

  listPlugins(): ActiveNodePlugin[] {
    return [...this.activePlugins.values()];
  }

  activatePlugin(options: ActivateNodePluginOptions): RuntimeEffect<void> {
    const activePlugins = this.activePlugins;
    const commandRegistry = this.commandRegistry;
    const createPluginStorage = this.createPluginStorage;
    const hostScope = this.scope;
    const loadPlugin = (entryPath: string) => this.loadPlugin(entryPath);
    const disposeSubscriptions = (context: PluginContextV1) => this.disposeSubscriptions(context);

    return Effect.gen(function* () {
      yield* validatePluginActivation(activePlugins, options);
      const plugin = yield* loadPlugin(options.entryPath);
      const context = createPluginContext(options.pluginId, commandRegistry, createPluginStorage);

      yield* activatePluginResource({
        activation: options,
        activePlugins,
        context,
        disposeSubscriptions,
        hostScope,
        plugin,
      });
    });
  }

  deactivatePlugin(pluginId: string): RuntimeEffect<void> {
    const activePlugins = this.activePlugins;

    return Effect.uninterruptible(
      Effect.gen(function* () {
        const activePlugin = activePlugins.get(pluginId);

        if (!activePlugin) {
          return;
        }

        activePlugins.delete(pluginId);

        yield* Scope.close(activePlugin.scope, Exit.succeed(undefined));

        if (activePlugin.cleanupFailures.length > 0) {
          return yield* Effect.fail(
            createRuntimeCleanupError(
              `Failed to deactivate plugin: ${pluginId}`,
              activePlugin.cleanupFailures,
            ),
          );
        }
      }),
    );
  }

  dispose(): RuntimeEffect<void> {
    const hostScope = this.scope;
    const disposeAll = () => this.disposeAll();

    return Effect.uninterruptible(
      Effect.gen(function* () {
        const pluginsExit = yield* Effect.exit(disposeAll());
        const scopeExit = yield* Effect.exit(Scope.close(hostScope, pluginsExit));

        if (Exit.isFailure(pluginsExit)) {
          return yield* Effect.failCause(pluginsExit.cause);
        }

        if (Exit.isFailure(scopeExit)) {
          return yield* Effect.failCause(scopeExit.cause);
        }
      }),
    );
  }

  disposeAll(): RuntimeEffect<void> {
    const activePlugins = this.activePlugins;
    const deactivatePlugin = (pluginId: string) => this.deactivatePlugin(pluginId);

    return Effect.uninterruptible(
      Effect.gen(function* () {
        const pluginIds = [...activePlugins.keys()].toReversed();
        const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

        for (const pluginId of pluginIds) {
          const exit = yield* Effect.exit(deactivatePlugin(pluginId));

          if (Exit.isFailure(exit)) {
            cleanupFailures.push(
              captureRuntimeCleanupFailure({
                step: "plugin.dispose",
                context: { pluginId },
                error: runtimeErrorFromCause(exit.cause),
              }),
            );
          }
        }

        if (cleanupFailures.length > 0) {
          return yield* Effect.fail(
            createRuntimeCleanupError("Failed to dispose all active plugins", cleanupFailures),
          );
        }
      }),
    );
  }

  private loadPlugin(entryPath: string): RuntimeEffect<ToolboxPluginV1> {
    const getDefaultExport = (module: unknown) => this.getDefaultExport(module);
    const isToolboxPluginV1 = (plugin: unknown) => this.isToolboxPluginV1(plugin);

    return Effect.gen(function* () {
      const module = yield* tryRuntimePromise({
        try: async () => import(pathToFileURL(entryPath).href),
        catch: (error) =>
          new RuntimeError({
            code: "ERR_PLUGIN_LOAD_FAILED",
            message: `Failed to load plugin entry: ${entryPath}`,
            cause: error,
          }),
      });
      const plugin = getDefaultExport(module);

      if (!isToolboxPluginV1(plugin)) {
        return yield* Effect.fail(
          new RuntimeError({
            code: "ERR_PLUGIN_LOAD_FAILED",
            message: `Plugin entry does not export a valid default plugin: ${entryPath}`,
          }),
        );
      }

      return plugin;
    });
  }

  private getDefaultExport(module: unknown): unknown {
    if (typeof module !== "object" || module === null || !("default" in module)) {
      return undefined;
    }

    return module.default;
  }

  private isToolboxPluginV1(plugin: unknown): plugin is ToolboxPluginV1 {
    return (
      typeof plugin === "object" &&
      plugin !== null &&
      "activate" in plugin &&
      typeof plugin.activate === "function"
    );
  }

  private disposeSubscriptions(context: PluginContextV1): RuntimeEffect<void> {
    return Effect.gen(function* () {
      const subscriptions = context.subscriptions.splice(0).toReversed();
      const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

      for (const subscription of subscriptions) {
        const exit = yield* Effect.exit(
          tryRuntimePromise({
            try: async () => subscription.dispose(),
            catch: toRuntimeError,
          }),
        );

        if (Exit.isFailure(exit)) {
          cleanupFailures.push(
            captureRuntimeCleanupFailure({
              step: "subscription.dispose",
              context: { pluginId: context.pluginId },
              error: runtimeErrorFromCause(exit.cause),
            }),
          );
        }
      }

      if (cleanupFailures.length > 0) {
        return yield* Effect.fail(
          createRuntimeCleanupError(
            `Failed to dispose ${cleanupFailures.length} plugin subscription(s): ${context.pluginId}`,
            cleanupFailures,
          ),
        );
      }
    });
  }
}

interface ActivatePluginResourceOptions {
  activation: ActivateNodePluginOptions;
  activePlugins: Map<string, ManagedActiveNodePlugin>;
  context: PluginContextV1;
  disposeSubscriptions: (context: PluginContextV1) => RuntimeEffect<void>;
  hostScope: Scope.CloseableScope;
  plugin: ToolboxPluginV1;
}

function validatePluginActivation(
  activePlugins: Map<string, ManagedActiveNodePlugin>,
  options: ActivateNodePluginOptions,
): RuntimeEffect<void> {
  if (activePlugins.has(options.pluginId)) {
    return Effect.fail(
      new RuntimeError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin is already active: ${options.pluginId}`,
      }),
    );
  }

  if (!path.isAbsolute(options.entryPath)) {
    return Effect.fail(
      new RuntimeError({
        code: "ERR_INVALID_ARGUMENT",
        message: `Node plugin entryPath must be absolute: ${options.entryPath}`,
      }),
    );
  }

  return Effect.void;
}

function createPluginContext(
  pluginId: string,
  commandRegistry: CommandRegistry,
  createPluginStorage: (pluginId: string) => PluginStorage,
): PluginContextV1 {
  return {
    pluginId,
    subscriptions: [],
    commands: commandRegistry,
    storage: createPluginStorage(pluginId),
  };
}

function activatePluginResource(options: ActivatePluginResourceOptions): RuntimeEffect<void> {
  return Effect.gen(function* () {
    const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];
    const pluginScope = yield* Scope.fork(options.hostScope, ExecutionStrategy.sequential);

    yield* addSubscriptionFinalizer(options, pluginScope, cleanupFailures);

    const activationExit = yield* Effect.exit(
      commitPluginActivation(options, pluginScope, cleanupFailures),
    );

    if (Exit.isFailure(activationExit)) {
      return yield* restorePluginActivationFailure(
        options.activation.pluginId,
        activationExit.cause,
        cleanupFailures,
      );
    }
  });
}

function commitPluginActivation(
  options: ActivatePluginResourceOptions,
  pluginScope: Scope.CloseableScope,
  cleanupFailures: CapturedRuntimeCleanupFailure[],
): RuntimeEffect<void> {
  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      yield* restore(
        tryRuntimePromise({
          try: async () => options.plugin.activate(options.context),
          catch: (error) =>
            new RuntimeError({
              code: "ERR_PLUGIN_LOAD_FAILED",
              message: `Failed to activate plugin: ${options.activation.pluginId}`,
              cause: error,
            }),
        }),
      );

      yield* addDeactivationFinalizer(options, pluginScope, cleanupFailures);

      options.activePlugins.set(options.activation.pluginId, {
        pluginId: options.activation.pluginId,
        entryPath: options.activation.entryPath,
        plugin: options.plugin,
        context: options.context,
        scope: pluginScope,
        cleanupFailures,
      });
    }).pipe(
      Effect.onExit((exit) =>
        Exit.isFailure(exit) ? Scope.close(pluginScope, exit) : Effect.void,
      ),
    ),
  );
}

function addSubscriptionFinalizer(
  options: ActivatePluginResourceOptions,
  pluginScope: Scope.CloseableScope,
  cleanupFailures: CapturedRuntimeCleanupFailure[],
): Effect.Effect<void> {
  return Scope.addFinalizer(
    pluginScope,
    options.disposeSubscriptions(options.context).pipe(
      Effect.catchAll((error) =>
        recordPluginCleanupFailure(cleanupFailures, {
          step: "subscriptions.dispose",
          pluginId: options.activation.pluginId,
          error,
        }),
      ),
    ),
  );
}

function addDeactivationFinalizer(
  options: ActivatePluginResourceOptions,
  pluginScope: Scope.CloseableScope,
  cleanupFailures: CapturedRuntimeCleanupFailure[],
): Effect.Effect<void> {
  if (!options.plugin.deactivate) {
    return Effect.void;
  }

  return Scope.addFinalizer(
    pluginScope,
    tryRuntimePromise({
      try: async () => options.plugin.deactivate?.(options.context),
      catch: toRuntimeError,
    }).pipe(
      Effect.catchAll((error) =>
        recordPluginCleanupFailure(cleanupFailures, {
          step: "plugin.deactivate",
          pluginId: options.activation.pluginId,
          error,
        }),
      ),
    ),
  );
}

function recordPluginCleanupFailure(
  cleanupFailures: CapturedRuntimeCleanupFailure[],
  options: {
    step: "plugin.deactivate" | "subscriptions.dispose";
    pluginId: string;
    error: unknown;
  },
): Effect.Effect<void> {
  return Effect.sync(() => {
    cleanupFailures.push(
      captureRuntimeCleanupFailure({
        step: options.step,
        context: { pluginId: options.pluginId },
        error: options.error,
      }),
    );
  });
}

function restorePluginActivationFailure(
  pluginId: string,
  cause: Cause.Cause<RuntimeError>,
  cleanupFailures: CapturedRuntimeCleanupFailure[],
): RuntimeEffect<never> {
  const typedFailure = Cause.failureOption(cause);

  if (Option.isSome(typedFailure) || cleanupFailures.length > 0) {
    return Effect.fail(
      combineRuntimePrimaryAndCleanupFailures(
        Option.isSome(typedFailure) ? typedFailure.value : runtimeErrorFromCause(cause),
        cleanupFailures,
        `Plugin activation and cleanup failed: ${pluginId}`,
      ),
    );
  }

  return Effect.failCause(cause);
}

function createMemoryPluginStorage(): PluginStorage {
  const values = new Map<string, unknown>();

  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
  };
}
