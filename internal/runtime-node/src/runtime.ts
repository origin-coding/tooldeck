import type { PluginStorage } from "@tooldeck/sdk-node";
import { Effect, ExecutionStrategy, Exit, Scope } from "effect";

import type { CommandInputCoercion } from "@/commands/input";
import { RuntimeCommandRegistry } from "@/commands/registry";
import {
  CommandService,
  type RunCommandOutput,
  type RunServiceCommandOptions,
} from "@/commands/service";
import { tryRuntimeBoundaryPromise, type RuntimeEffect } from "@/effect";
import type { RuntimeError } from "@/errors/error";
import type { PluginHost } from "@/hosts/host";
import { NodePluginHost } from "@/hosts/node";
import { PluginHostRegistry } from "@/hosts/registry";
import { ManifestIndex } from "@/manifests/catalog";
import { PluginManager } from "@/plugins/manager";
import { scanPluginSources, type PluginScanSource } from "@/plugins/scanner";

export interface CreateRuntimeAfterScanContext {
  manifestIndex: ManifestIndex;
  pluginCount: number;
  commandCount: number;
}

export interface PluginHostFactoryContext {
  commandRegistry: RuntimeCommandRegistry;
  scope: Scope.CloseableScope;
}

export type PluginHostFactory = (context: PluginHostFactoryContext) => PluginHost;

export interface CreateRuntimeOptions {
  pluginSources: PluginScanSource[];
  parentScope?: Scope.CloseableScope;
  hostFactories?: readonly PluginHostFactory[];
  coercion?: CommandInputCoercion;
  createPluginStorage?: (pluginId: string) => PluginStorage;
  afterScan?: (context: CreateRuntimeAfterScanContext) => void | Promise<void>;
}

export interface CreatedRuntime {
  commandRegistry: RuntimeCommandRegistry;
  hostRegistry: PluginHostRegistry;
  manifestIndex: ManifestIndex;
  pluginManager: PluginManager;
  commandService: CommandService;
  pluginCount: number;
  commandCount: number;
  runCommand(options: RunServiceCommandOptions): RuntimeEffect<RunCommandOutput>;
  dispose(): RuntimeEffect<void>;
}

export function createRuntime(options: CreateRuntimeOptions): RuntimeEffect<CreatedRuntime> {
  return Effect.gen(function* () {
    const runtimeScope = yield* createRuntimeScope(options.parentScope);

    return yield* createRuntimeResources(options, runtimeScope).pipe(
      Effect.onExit((exit) => closeScopeOnFailure(runtimeScope, exit)),
    );
  });
}

function createRuntimeScope(
  parentScope: Scope.CloseableScope | undefined,
): Effect.Effect<Scope.CloseableScope> {
  return parentScope
    ? Scope.fork(parentScope, ExecutionStrategy.sequential)
    : Scope.make(ExecutionStrategy.sequential);
}

function createRuntimeResources(
  options: CreateRuntimeOptions,
  runtimeScope: Scope.CloseableScope,
): RuntimeEffect<CreatedRuntime> {
  return Effect.gen(function* () {
    const commandRegistry = new RuntimeCommandRegistry();
    const hostRegistry = new PluginHostRegistry();
    const manifestIndex = new ManifestIndex();

    yield* registerPluginHosts(options, runtimeScope, commandRegistry, hostRegistry);

    const scanResult = yield* scanRuntimePlugins(options, manifestIndex);
    const pluginManager = new PluginManager({ manifestIndex, commandRegistry, hostRegistry });
    const commandService = new CommandService({
      pluginManager,
      coercion: options.coercion ?? "none",
    });

    return {
      commandRegistry,
      hostRegistry,
      manifestIndex,
      pluginManager,
      commandService,
      pluginCount: scanResult.pluginCount,
      commandCount: scanResult.commandCount,
      runCommand: (commandOptions) =>
        tryRuntimeBoundaryPromise(async () => commandService.runCommand(commandOptions)),
      dispose: () => disposeRuntimeResources(hostRegistry, runtimeScope),
    };
  });
}

function registerPluginHosts(
  options: CreateRuntimeOptions,
  runtimeScope: Scope.CloseableScope,
  commandRegistry: RuntimeCommandRegistry,
  hostRegistry: PluginHostRegistry,
): RuntimeEffect<void> {
  const hostFactories = options.hostFactories ?? createDefaultHostFactories(options);

  return Effect.gen(function* () {
    for (const createHost of hostFactories) {
      const hostScope = yield* Scope.fork(runtimeScope, ExecutionStrategy.sequential);
      const host = createHost({ commandRegistry, scope: hostScope });

      hostRegistry.register(host);
    }
  });
}

function createDefaultHostFactories(options: CreateRuntimeOptions): readonly PluginHostFactory[] {
  return [
    ({ commandRegistry, scope }) =>
      new NodePluginHost({
        commandRegistry,
        createPluginStorage: options.createPluginStorage,
        scope,
      }),
  ];
}

function scanRuntimePlugins(
  options: CreateRuntimeOptions,
  manifestIndex: ManifestIndex,
): RuntimeEffect<{ pluginCount: number; commandCount: number }> {
  return Effect.gen(function* () {
    const scanResult = yield* tryRuntimeBoundaryPromise(async () =>
      scanPluginSources({
        sources: options.pluginSources,
        manifestIndex,
      }),
    );

    if (options.afterScan) {
      yield* tryRuntimeBoundaryPromise(async () =>
        options.afterScan?.({
          manifestIndex,
          pluginCount: scanResult.pluginCount,
          commandCount: scanResult.commandCount,
        }),
      );
    }

    return scanResult;
  });
}

function disposeRuntimeResources(
  hostRegistry: PluginHostRegistry,
  runtimeScope: Scope.CloseableScope,
): RuntimeEffect<void> {
  return Effect.uninterruptible(
    Effect.gen(function* () {
      const hostsExit = yield* Effect.exit(hostRegistry.disposeAll());
      const scopeExit = yield* Effect.exit(Scope.close(runtimeScope, hostsExit));

      if (Exit.isFailure(hostsExit)) {
        return yield* Effect.failCause(hostsExit.cause);
      }

      if (Exit.isFailure(scopeExit)) {
        return yield* Effect.failCause(scopeExit.cause);
      }
    }),
  );
}

function closeScopeOnFailure(
  scope: Scope.CloseableScope,
  exit: Exit.Exit<CreatedRuntime, RuntimeError>,
): Effect.Effect<void> {
  return Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void;
}
