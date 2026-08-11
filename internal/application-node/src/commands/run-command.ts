import { performance } from "node:perf_hooks";

import type { CommandResult, JsonObject } from "@tooldeck/protocol";
import type { CreatedRuntime, RunCommandOutput } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit } from "effect";

import type { CommandInputPreprocessor } from "@/application/adapters";
import { applicationErrorFromCause } from "@/application/edge";
import {
  type ApplicationEffect,
  type ApplicationFailure,
  tryApplicationPromise,
  tryApplicationSync,
} from "@/application/effect";
import { localizeApplicationCommandResult } from "@/application/localization";
import type { RunApplicationCommandRequest } from "@/commands/types";
import { ApplicationError } from "@/errors/application-error";
import { toApplicationErrorTransport } from "@/errors/application-error-transport";
import type { CommandRunRepository, PluginRepository } from "@/storage";

export interface ApplicationCommandDependencies {
  readonly getRuntime: () => Pick<CreatedRuntime, "manifestIndex" | "pluginManager" | "runCommand">;
  readonly getCommandRuns: () => Pick<CommandRunRepository, "create">;
  readonly getPlugins: () => Pick<PluginRepository, "getById">;
  readonly preprocessInput: CommandInputPreprocessor;
}

interface RunCommandResources {
  commandRuns: Pick<CommandRunRepository, "create">;
  runtime: Pick<CreatedRuntime, "manifestIndex" | "pluginManager" | "runCommand">;
  pluginId: string | undefined;
}

interface RunCommandState {
  startedAt: number;
  source: string;
  recordHistory: boolean;
  historyInput: JsonObject;
}

interface ExecutedCommand {
  result: CommandResult;
  normalizedInput: RunCommandOutput["input"];
}

export function runApplicationCommand(
  dependencies: ApplicationCommandDependencies,
  request: RunApplicationCommandRequest,
): ApplicationEffect<CommandResult> {
  return Effect.suspend(() => {
    const state: RunCommandState = {
      startedAt: performance.now(),
      source: request?.source ?? "application",
      recordHistory: request?.recordHistory ?? true,
      historyInput: request?.input ?? {},
    };

    return runCommandWorkflow(dependencies, request, state);
  });
}

function runCommandWorkflow(
  dependencies: ApplicationCommandDependencies,
  request: RunApplicationCommandRequest,
  state: RunCommandState,
): ApplicationEffect<CommandResult> {
  return Effect.gen(function* () {
    const resources = yield* resolveRunCommandResources(dependencies, request);
    const executionExit = yield* Effect.exit(
      executeCommand(dependencies, resources, request, state),
    );

    return yield* completeCommand(resources, request, state, executionExit);
  });
}

function resolveRunCommandResources(
  dependencies: ApplicationCommandDependencies,
  request: RunApplicationCommandRequest,
): ApplicationEffect<RunCommandResources> {
  return tryApplicationSync(() => {
    assertRunCommandRequest(request);

    const runtime = dependencies.getRuntime();

    return {
      commandRuns: dependencies.getCommandRuns(),
      runtime,
      pluginId: runtime.manifestIndex.getCommandOwner(request.commandId),
    };
  });
}

function executeCommand(
  dependencies: ApplicationCommandDependencies,
  resources: RunCommandResources,
  request: RunApplicationCommandRequest,
  state: RunCommandState,
): ApplicationEffect<ExecutedCommand> {
  return Effect.gen(function* () {
    yield* assertCommandPluginEnabled(dependencies, resources, request.commandId);

    state.historyInput = yield* tryApplicationPromise(async () =>
      dependencies.preprocessInput({
        commandId: request.commandId,
        source: state.source,
        input: state.historyInput,
      }),
    );

    const run = yield* resources.runtime.runCommand({
      commandId: request.commandId,
      input: state.historyInput,
    });
    const result = yield* tryApplicationSync(() =>
      localizeApplicationCommandResult(
        run.result,
        resources.pluginId
          ? resources.runtime.manifestIndex.getPlugin(resources.pluginId)
          : undefined,
        request.locale,
      ),
    );

    return { result, normalizedInput: run.input };
  });
}

function assertCommandPluginEnabled(
  dependencies: ApplicationCommandDependencies,
  resources: RunCommandResources,
  commandId: string,
): ApplicationEffect<void> {
  return tryApplicationSync(() =>
    assertPluginEnabled({
      commandId,
      pluginId: resources.pluginId,
      enabled: resources.pluginId
        ? dependencies.getPlugins().getById(resources.pluginId)?.enabled
        : undefined,
    }),
  );
}

function completeCommand(
  resources: RunCommandResources,
  request: RunApplicationCommandRequest,
  state: RunCommandState,
  executionExit: Exit.Exit<ExecutedCommand, ApplicationFailure>,
): ApplicationEffect<CommandResult> {
  return Exit.isSuccess(executionExit)
    ? completeSuccessfulCommand(resources, request, state, executionExit.value)
    : completeFailedCommand(resources, request, state, executionExit.cause);
}

function completeSuccessfulCommand(
  resources: RunCommandResources,
  request: RunApplicationCommandRequest,
  state: RunCommandState,
  execution: ExecutedCommand,
): ApplicationEffect<CommandResult> {
  if (!state.recordHistory) {
    return Effect.succeed(execution.result);
  }

  return tryApplicationSync(() =>
    resources.commandRuns.create({
      commandId: request.commandId,
      pluginId: resources.pluginId,
      source: state.source,
      status: execution.result.status,
      input: execution.normalizedInput,
      output: execution.result,
      durationMs: elapsedMilliseconds(state.startedAt),
    }),
  ).pipe(Effect.as(execution.result));
}

function completeFailedCommand(
  resources: RunCommandResources,
  request: RunApplicationCommandRequest,
  state: RunCommandState,
  cause: Cause.Cause<ApplicationFailure>,
): ApplicationEffect<never> {
  const primaryError = applicationErrorFromCause(cause);

  if (!state.recordHistory) {
    return Effect.fail(primaryError);
  }

  return Effect.gen(function* () {
    const historyExit = yield* Effect.exit(
      tryApplicationSync(() =>
        resources.commandRuns.create({
          commandId: request.commandId,
          pluginId: resources.pluginId,
          source: state.source,
          status: "error",
          input: state.historyInput,
          error: toApplicationErrorTransport(primaryError),
          durationMs: elapsedMilliseconds(state.startedAt),
        }),
      ),
    );

    if (Exit.isFailure(historyExit)) {
      return yield* Effect.fail(
        preserveCommandFailureWhenHistoryFails(
          primaryError,
          applicationErrorFromCause(historyExit.cause),
        ),
      );
    }

    return yield* Effect.fail(primaryError);
  });
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

function preserveCommandFailureWhenHistoryFails(
  primaryError: ApplicationError,
  historyError: ApplicationError,
): ApplicationError {
  return new ApplicationError({
    source: primaryError.source,
    code: primaryError.code,
    message: primaryError.message,
    details: primaryError.details,
    cause: new AggregateError(
      [primaryError, historyError],
      "Command execution and command history persistence both failed.",
      { cause: primaryError },
    ),
  });
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}
