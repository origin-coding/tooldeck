import { Effect, Exit } from "effect";

import type { TooldeckApplicationAdapters } from "@/application/adapters";
import { TooldeckApplicationContext } from "@/application/context";
import { applicationErrorFromCause, runApplicationEffect } from "@/application/edge";
import {
  type ApplicationEffect,
  type ApplicationFailure,
  tryApplicationPromise,
} from "@/application/effect";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { ApplicationCommands } from "@/commands/application-commands";
import type { ApplicationCommandFacade } from "@/commands/types";
import {
  captureApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
} from "@/errors/application-cleanup";
import { toApplicationError } from "@/errors/application-error";
import { ApplicationHistory } from "@/history/application-history";
import type { ApplicationHistoryFacade } from "@/history/types";
import type { TooldeckPaths } from "@/paths";
import { ApplicationPlugins } from "@/plugins/application-plugins";
import type { ApplicationPluginFacade } from "@/plugins/facade-types";
import { ApplicationPreferences } from "@/preferences/application-preferences";
import type { ApplicationPreferenceFacade } from "@/preferences/facade-types";

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
  readonly commands: ApplicationCommands;
  readonly plugins: ApplicationPlugins;
  readonly preferences: ApplicationPreferences;
  readonly history: ApplicationHistory;

  private readonly context: TooldeckApplicationContext;

  constructor(options: CreateTooldeckApplicationOptions) {
    this.context = new TooldeckApplicationContext(options);
    this.paths = this.context.paths;
    this.commands = new ApplicationCommands(this.context);
    this.plugins = new ApplicationPlugins(this.context, this.commands);
    this.preferences = new ApplicationPreferences(this.context);
    this.history = new ApplicationHistory(this.context);
  }

  start(): Promise<void> {
    return this.context.start();
  }

  dispose(): Promise<void> {
    return this.context.dispose();
  }

  startEffect(): ApplicationEffect<void> {
    return this.context.startEffect();
  }

  disposeEffect(): ApplicationEffect<void> {
    return this.context.disposeEffect();
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
