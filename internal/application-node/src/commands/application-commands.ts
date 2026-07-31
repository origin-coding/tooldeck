import { performance } from "node:perf_hooks";

import type { CommandResult, JsonObject } from "@tooldeck/protocol";

import type { TooldeckApplicationContext } from "@/application/context";
import { runApplicationOperation } from "@/application/edge";
import type {
  ApplicationCommand,
  ApplicationCommandFacade,
  RunApplicationCommandRequest,
} from "@/commands/types";
import { ApplicationError, toApplicationError } from "@/errors/application-error";
import { toApplicationErrorTransport } from "@/errors/application-error-transport";

export class ApplicationCommands implements ApplicationCommandFacade {
  constructor(private readonly context: TooldeckApplicationContext) {}

  list(): Promise<ApplicationCommand[]> {
    return runApplicationOperation(() => {
      const runtime = this.context.requireRuntime();
      const plugins = this.context.requirePlugins();

      return runtime.manifestIndex.listCommands().map((command) => ({
        id: command.id,
        pluginId: command.pluginId,
        pluginEnabled: plugins.getById(command.pluginId)?.enabled ?? false,
        pluginRuntimeState: runtime.pluginManager.getPluginRuntimeState(command.pluginId),
        definition: command.definition,
      }));
    });
  }

  run(request: RunApplicationCommandRequest): Promise<CommandResult> {
    return runApplicationOperation(async () => {
      assertRunCommandRequest(request);

      const commandRuns = this.context.requireCommandRuns();
      const runtime = this.context.requireRuntime();
      const pluginId = runtime.manifestIndex.getCommandOwner(request.commandId);
      const source = request.source ?? "application";
      const recordHistory = request.recordHistory ?? true;
      const startedAt = performance.now();
      let historyInput: JsonObject = request.input ?? {};

      try {
        assertPluginEnabled({
          commandId: request.commandId,
          pluginId,
          enabled: pluginId ? this.context.requirePlugins().getById(pluginId)?.enabled : undefined,
        });

        historyInput = await this.context.preprocessCommandInput({
          commandId: request.commandId,
          source,
          input: historyInput,
        });

        const run = await runtime.commandService.runCommand({
          commandId: request.commandId,
          input: historyInput,
        });

        if (recordHistory) {
          commandRuns.create({
            commandId: request.commandId,
            pluginId,
            source,
            status: run.result.status,
            input: run.input,
            output: run.result,
            durationMs: elapsedMilliseconds(startedAt),
          });
        }

        return run.result;
      } catch (error) {
        if (recordHistory) {
          commandRuns.create({
            commandId: request.commandId,
            pluginId,
            source,
            status: "error",
            input: historyInput,
            error: toApplicationErrorTransport(toApplicationError(error)),
            durationMs: elapsedMilliseconds(startedAt),
          });
        }

        throw error;
      }
    });
  }
}

function assertRunCommandRequest(
  request: RunApplicationCommandRequest,
): asserts request is RunApplicationCommandRequest {
  if (!request || typeof request.commandId !== "string" || request.commandId.length === 0) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Running a command requires a command id.",
    });
  }
}

function assertPluginEnabled(options: {
  commandId: string;
  pluginId: string | undefined;
  enabled: boolean | undefined;
}): void {
  if (!options.pluginId || options.enabled !== false) {
    return;
  }

  throw new ApplicationError({
    source: "application",
    code: "ERR_PLUGIN_DISABLED",
    message: `Plugin is disabled for command ${options.commandId}: ${options.pluginId}`,
    details: {
      commandId: options.commandId,
      pluginId: options.pluginId,
    },
  });
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}
