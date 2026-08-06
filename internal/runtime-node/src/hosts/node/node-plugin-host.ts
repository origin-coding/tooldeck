import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CommandRegistry,
  PluginContextV1,
  PluginStorage,
  ToolboxPluginV1,
} from "@tooldeck/sdk-node";
import { Cause, Effect, Exit, Option, Scope } from "effect";

import type { PluginHost, PluginHostActivateOptions } from "@/core/plugin-host";
import {
  runtimeErrorFromCause,
  tryRuntimePromise,
  type RuntimeEffect,
} from "@/effects/runtime-effect";
import {
  captureRuntimeCleanupFailure,
  combineRuntimePrimaryAndCleanupFailures,
  createRuntimeCleanupError,
  type CapturedRuntimeCleanupFailure,
} from "@/errors/runtime-cleanup";
import { RuntimeError, toRuntimeError } from "@/errors/runtime-error";

export interface NodePluginHostOptions {
  commandRegistry: CommandRegistry;
  createPluginStorage?: (pluginId: string) => PluginStorage;
}

export type ActivateNodePluginOptions = PluginHostActivateOptions;

export interface ActiveNodePlugin {
  pluginId: string;
  entryPath: string;
  plugin: ToolboxPluginV1;
  context: PluginContextV1;
}

interface ManagedActiveNodePlugin extends ActiveNodePlugin {
  subscriptionScope: Scope.CloseableScope;
  subscriptionCleanupFailures: CapturedRuntimeCleanupFailure[];
}

export class NodePluginHost implements PluginHost {
  readonly kind = "node";

  private readonly commandRegistry: CommandRegistry;
  private readonly createPluginStorage: (pluginId: string) => PluginStorage;
  private readonly activePlugins = new Map<string, ManagedActiveNodePlugin>();

  constructor(options: NodePluginHostOptions) {
    this.commandRegistry = options.commandRegistry;
    this.createPluginStorage = options.createPluginStorage ?? createMemoryPluginStorage;
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
    const loadPlugin = (entryPath: string) => this.loadPlugin(entryPath);
    const disposeSubscriptions = (context: PluginContextV1) => this.disposeSubscriptions(context);

    return Effect.gen(function* () {
      if (activePlugins.has(options.pluginId)) {
        return yield* Effect.fail(
          new RuntimeError({
            code: "ERR_ALREADY_EXISTS",
            message: `Plugin is already active: ${options.pluginId}`,
          }),
        );
      }

      if (!path.isAbsolute(options.entryPath)) {
        return yield* Effect.fail(
          new RuntimeError({
            code: "ERR_INVALID_ARGUMENT",
            message: `Node plugin entryPath must be absolute: ${options.entryPath}`,
          }),
        );
      }

      const plugin = yield* loadPlugin(options.entryPath);
      const context: PluginContextV1 = {
        pluginId: options.pluginId,
        subscriptions: [],
        commands: commandRegistry,
        storage: createPluginStorage(options.pluginId),
      };
      const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];
      const subscriptionScope = yield* Scope.make();

      yield* Scope.addFinalizer(
        subscriptionScope,
        disposeSubscriptions(context).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              cleanupFailures.push(
                captureRuntimeCleanupFailure({
                  step: "subscriptions.dispose",
                  context: { pluginId: options.pluginId },
                  error,
                }),
              );
            }),
          ),
        ),
      );

      const activationExit = yield* Effect.exit(
        tryRuntimePromise({
          try: async () => plugin.activate(context),
          catch: (error) =>
            new RuntimeError({
              code: "ERR_PLUGIN_LOAD_FAILED",
              message: `Failed to activate plugin: ${options.pluginId}`,
              cause: error,
            }),
        }).pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit) ? Scope.close(subscriptionScope, exit) : Effect.void,
          ),
        ),
      );

      if (Exit.isFailure(activationExit)) {
        const typedFailure = Cause.failureOption(activationExit.cause);

        if (Option.isSome(typedFailure) || cleanupFailures.length > 0) {
          return yield* Effect.fail(
            combineRuntimePrimaryAndCleanupFailures(
              Option.isSome(typedFailure)
                ? typedFailure.value
                : runtimeErrorFromCause(activationExit.cause),
              cleanupFailures,
              `Plugin activation and cleanup failed: ${options.pluginId}`,
            ),
          );
        }

        return yield* Effect.failCause(activationExit.cause);
      }

      activePlugins.set(options.pluginId, {
        pluginId: options.pluginId,
        entryPath: options.entryPath,
        plugin,
        context,
        subscriptionScope,
        subscriptionCleanupFailures: cleanupFailures,
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

        const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

        if (activePlugin.plugin.deactivate) {
          const deactivationExit = yield* Effect.exit(
            tryRuntimePromise({
              try: async () => activePlugin.plugin.deactivate?.(activePlugin.context),
              catch: toRuntimeError,
            }),
          );

          if (Exit.isFailure(deactivationExit)) {
            cleanupFailures.push(
              captureRuntimeCleanupFailure({
                step: "plugin.deactivate",
                context: { pluginId },
                error: runtimeErrorFromCause(deactivationExit.cause),
              }),
            );
          }
        }

        yield* Scope.close(activePlugin.subscriptionScope, Exit.succeed(undefined));

        cleanupFailures.push(...activePlugin.subscriptionCleanupFailures);

        if (cleanupFailures.length > 0) {
          return yield* Effect.fail(
            createRuntimeCleanupError(`Failed to deactivate plugin: ${pluginId}`, cleanupFailures),
          );
        }
      }),
    );
  }

  dispose(): RuntimeEffect<void> {
    return this.disposeAll();
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
