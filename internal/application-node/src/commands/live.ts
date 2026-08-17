import { Effect, Layer } from "effect";

import type { CommandInputPreprocessor } from "@/application/adapters";
import type { ApplicationEffect } from "@/application/effect";
import { localizeApplicationCommand } from "@/application/localization";
import { Commands, type CommandsService } from "@/commands/context";
import { type ApplicationCommandDependencies, runApplicationCommand } from "@/commands/run-command";
import { ListApplicationCommandsRequestSchema } from "@/commands/schema";
import type {
  ListApplicationCommandsRequest,
  RunApplicationCommandRequest,
} from "@/commands/types";
import { Runtime, type RuntimeService } from "@/runtime/context";
import { ApplicationStorage, type ApplicationStorageService } from "@/storage/context";
import { decodeApplicationRequest } from "@/validation/effect-schema";

export interface CommandsLiveOptions {
  readonly preprocessInput: CommandInputPreprocessor;
}

interface CommandsServiceDependencies {
  readonly runtime: RuntimeService;
  readonly getStorage: () => ApplicationEffect<ApplicationStorageService>;
  readonly preprocessInput: CommandInputPreprocessor;
}

export function makeCommandsLive(
  options: CommandsLiveOptions,
): Layer.Layer<Commands, never, Runtime | ApplicationStorage> {
  return Layer.effect(
    Commands,
    Effect.gen(function* () {
      const runtime = yield* Runtime;
      const storage = yield* ApplicationStorage;

      return makeCommandsService({
        runtime,
        getStorage: () => Effect.succeed(storage),
        preprocessInput: options.preprocessInput,
      });
    }),
  );
}

export function makeCommandsService(dependencies: CommandsServiceDependencies): CommandsService {
  const commandDependencies: ApplicationCommandDependencies = {
    getRuntime: dependencies.runtime.current,
    getCommandRuns: () =>
      dependencies.getStorage().pipe(Effect.map((storage) => storage.repositories.commandRuns)),
    getPlugins: () =>
      dependencies.getStorage().pipe(Effect.map((storage) => storage.repositories.plugins)),
    preprocessInput: dependencies.preprocessInput,
  };

  return Object.freeze({
    list: (request: ListApplicationCommandsRequest = {}) =>
      Effect.gen(function* () {
        const decoded = yield* decodeApplicationRequest(
          ListApplicationCommandsRequestSchema,
          request,
          "commands.list",
        );
        const runtime = yield* dependencies.runtime.current();
        const storage = yield* dependencies.getStorage();

        return runtime.manifestIndex.listCommands().map((command) =>
          localizeApplicationCommand(
            {
              id: command.id,
              pluginId: command.pluginId,
              pluginEnabled:
                storage.repositories.plugins.getById(command.pluginId)?.enabled ?? false,
              pluginRuntimeState: runtime.pluginManager.getPluginRuntimeState(command.pluginId),
              definition: command.definition,
            },
            runtime.manifestIndex.getPlugin(command.pluginId),
            decoded.locale,
          ),
        );
      }),
    run: (request: RunApplicationCommandRequest) =>
      runApplicationCommand(commandDependencies, request),
  });
}
