import path from "node:path";

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { Commands, type CommandsService } from "@/commands/context";
import { makeCommandsLive } from "@/commands/live";
import { History } from "@/history/context";
import { makeHistoryLive } from "@/history/live";
import { Plugins } from "@/plugins/context";
import { makePluginsLive } from "@/plugins/live";
import { Preferences } from "@/preferences/context";
import { makePreferencesLive } from "@/preferences/live";
import { Runtime, type ApplicationRuntime, type RuntimeService } from "@/runtime";
import {
  type ApplicationRepositories,
  ApplicationStorage,
  type ApplicationStorageService,
} from "@/storage/context";

describe("application domain Live Layers", () => {
  it("builds all four domain services from replaceable Runtime and Storage Layers", async () => {
    const installedPluginsDir = path.resolve("test", ".fixtures", "domain-live", "installed");
    const infrastructure = Layer.mergeAll(
      Layer.succeed(Runtime, createRuntimeService()),
      Layer.succeed(ApplicationStorage, createStorageService()),
    );
    const commands = makeCommandsLive({
      preprocessInput: ({ input }) => input,
    }).pipe(Layer.provide(infrastructure));
    const preferences = makePreferencesLive().pipe(Layer.provide(infrastructure));
    const history = makeHistoryLive().pipe(Layer.provide(infrastructure));
    const replacementCommands = Layer.succeed(Commands, createCommandsService());
    const plugins = makePluginsLive({
      installedPluginsDir,
      pluginSources: [{ kind: "installed", path: installedPluginsDir }],
    }).pipe(Layer.provide(Layer.merge(infrastructure, replacementCommands)));
    const domains = Layer.mergeAll(commands, plugins, preferences, history);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const commandService = yield* Commands;
        const pluginService = yield* Plugins;
        const preferenceService = yield* Preferences;
        const historyService = yield* History;

        return {
          commands: yield* commandService.list(),
          plugins: yield* pluginService.list(),
          preferences: yield* preferenceService.list({ scopes: ["cli"] }),
          history: yield* historyService.listCommandRuns(),
          frozen: [commandService, pluginService, preferenceService, historyService].every(
            Object.isFrozen,
          ),
        };
      }).pipe(Effect.provide(domains)),
    );

    expect(result.commands).toEqual([]);
    expect(result.plugins).toEqual([]);
    expect(result.preferences.every((preference) => preference.scope === "cli")).toBe(true);
    expect(result.history).toEqual([]);
    expect(result.frozen).toBe(true);
  });

  it("keeps PluginsLive configuration failures in the typed Application boundary", async () => {
    const installedPluginsDir = path.resolve(
      "test",
      ".fixtures",
      "domain-live-invalid",
      "installed",
    );
    const infrastructure = Layer.mergeAll(
      Layer.succeed(Runtime, createRuntimeService()),
      Layer.succeed(ApplicationStorage, createStorageService()),
    );
    const commands = Layer.succeed(Commands, createCommandsService());
    const plugins = makePluginsLive({
      installedPluginsDir,
      pluginSources: [],
    }).pipe(Layer.provide(Layer.merge(infrastructure, commands)));

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* Plugins;
      }).pipe(Effect.provide(plugins)),
    );

    expect(exit).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: { code: "ERR_INVALID_ARGUMENT" },
      },
    });
  });
});

function createCommandsService(): CommandsService {
  return Object.freeze({
    list: () => Effect.succeed([]),
    run: () => Effect.die("Unexpected command execution."),
  });
}

function createRuntimeService(): RuntimeService {
  const runtime: ApplicationRuntime = Object.freeze({
    manifestIndex: Object.freeze({
      getCommandOwner: () => undefined,
      getPlugin: () => undefined,
      hasPlugin: () => false,
      listCommands: () => [],
    }),
    pluginManager: Object.freeze({
      getPluginRuntimeState: () => "inactive" as const,
    }),
    runCommand: () => Effect.die("Unexpected command execution."),
  });

  return Object.freeze({
    current: () => Effect.succeed(runtime),
    rebuild: () => Effect.void,
    dispose: () => Effect.void,
  });
}

function createStorageService(): ApplicationStorageService {
  const repositories = {
    commandRuns: { listRecent: () => [] },
    preferences: { getRow: () => undefined },
    plugins: { getById: () => undefined, list: () => [] },
    pluginInstalls: {},
    pluginStates: {},
    pluginKv: {},
  } as unknown as ApplicationRepositories;

  const withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"] = <A>(
    operation: () => A,
  ) => Effect.sync(operation);

  return Object.freeze({
    repositories: Object.freeze(repositories),
    withImmediateTransaction,
  });
}
