import { Effect, Exit } from "effect";

import type { TooldeckApplicationAdapters } from "@/application/adapters";
import { composeTooldeckApplication } from "@/application/composition";
import {
  applicationErrorFromCause,
  type ApplicationEffect,
  type ApplicationFailure,
  runApplicationEffect,
  tryApplicationPromise,
} from "@/application/effect";
import type { ApplicationLifecycleCoordinator } from "@/application/lifecycle";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import type { ApplicationCommandFacade } from "@/commands/types";
import {
  captureApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
} from "@/errors/cleanup";
import { toApplicationError } from "@/errors/error";
import type { ApplicationHistoryFacade } from "@/history/types";
import type { TooldeckPaths } from "@/paths";
import type { ApplicationPluginFacade } from "@/plugins/types";
import type { ApplicationPreferenceFacade } from "@/preferences/types";

export interface TooldeckApplication {
  readonly paths: TooldeckPaths;
  readonly commands: ApplicationCommandFacade;
  readonly plugins: ApplicationPluginFacade;
  readonly preferences: ApplicationPreferenceFacade;
  readonly history: ApplicationHistoryFacade;

  start(): Promise<void>;
  dispose(): Promise<void>;
}

class DefaultTooldeckApplication implements TooldeckApplication {
  readonly paths: TooldeckPaths;
  readonly commands: ApplicationCommandFacade;
  readonly plugins: ApplicationPluginFacade;
  readonly preferences: ApplicationPreferenceFacade;
  readonly history: ApplicationHistoryFacade;

  private readonly lifecycle: ApplicationLifecycleCoordinator;

  constructor(options: CreateTooldeckApplicationOptions) {
    const composition = composeTooldeckApplication(options);

    this.lifecycle = composition.lifecycle;
    this.paths = composition.configuration.paths;
    this.commands = composition.facades.commands;
    this.plugins = composition.facades.plugins;
    this.preferences = composition.facades.preferences;
    this.history = composition.facades.history;
  }

  start(): Promise<void> {
    return this.lifecycle.start();
  }

  dispose(): Promise<void> {
    return this.lifecycle.dispose();
  }

  startEffect(): ApplicationEffect<void> {
    return this.lifecycle.startEffect();
  }

  disposeEffect(): ApplicationEffect<void> {
    return this.lifecycle.disposeEffect();
  }
}

export function createTooldeckApplication(
  options: CreateTooldeckApplicationOptions = {},
): TooldeckApplication {
  try {
    return new DefaultTooldeckApplication(options);
  } catch (error) {
    throw toApplicationError(error);
  }
}

export async function withTooldeckApplication<TResult>(
  options: CreateTooldeckApplicationOptions,
  callback: (application: TooldeckApplication) => TResult | Promise<TResult>,
): Promise<TResult> {
  let application: DefaultTooldeckApplication;

  try {
    application = new DefaultTooldeckApplication(options);
  } catch (error) {
    throw toApplicationError(error);
  }

  return runApplicationEffect(
    Effect.gen(function* () {
      const callbackExit = yield* Effect.exit(useTooldeckApplication(application, callback));
      const disposeExit = yield* Effect.exit(application.disposeEffect());

      return yield* completeTooldeckApplicationUse(callbackExit, disposeExit);
    }),
  );
}

function useTooldeckApplication<TResult>(
  application: DefaultTooldeckApplication,
  callback: (application: TooldeckApplication) => TResult | Promise<TResult>,
): ApplicationEffect<TResult> {
  return Effect.gen(function* () {
    yield* application.startEffect();
    return yield* tryApplicationPromise(async () => callback(application));
  });
}

function completeTooldeckApplicationUse<TResult>(
  callbackExit: Exit.Exit<TResult, ApplicationFailure>,
  disposeExit: Exit.Exit<void, ApplicationFailure>,
): ApplicationEffect<TResult> {
  if (Exit.isFailure(callbackExit)) {
    const primaryError = applicationErrorFromCause(callbackExit.cause);

    if (Exit.isFailure(disposeExit)) {
      return Effect.fail(
        combinePrimaryAndCleanupFailures(
          primaryError,
          [
            captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "application.dispose",
              context: {},
              error: applicationErrorFromCause(disposeExit.cause),
            }),
          ],
          "Tooldeck application operation failed and resources did not dispose cleanly.",
        ),
      );
    }

    return Effect.fail(primaryError);
  }

  return Exit.isFailure(disposeExit)
    ? Effect.failCause(disposeExit.cause)
    : Effect.succeed(callbackExit.value);
}

export function defineTooldeckApplicationAdapters(
  adapters: TooldeckApplicationAdapters,
): TooldeckApplicationAdapters {
  return adapters;
}
