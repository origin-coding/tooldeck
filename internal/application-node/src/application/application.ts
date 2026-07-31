import type { TooldeckApplicationAdapters } from "@/application/adapters";
import { TooldeckApplicationContext } from "@/application/context";
import { runApplicationOperation } from "@/application/edge";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { ApplicationCommands } from "@/commands/application-commands";
import type { ApplicationCommandFacade } from "@/commands/types";
import { ApplicationError, toApplicationError } from "@/errors/application-error";
import { toApplicationErrorTransport } from "@/errors/application-error-transport";
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
    return runApplicationOperation(() => this.context.start());
  }

  dispose(): Promise<void> {
    return runApplicationOperation(() => this.context.dispose());
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
  const application = createTooldeckApplication(options);
  let callbackOutcome: { success: true; value: TResult } | { success: false; error: unknown };

  try {
    await application.start();
    callbackOutcome = {
      success: true,
      value: await callback(application),
    };
  } catch (error) {
    callbackOutcome = { success: false, error };
  }

  let disposeOutcome: { success: true } | { success: false; error: unknown };

  try {
    await application.dispose();
    disposeOutcome = { success: true };
  } catch (error) {
    disposeOutcome = { success: false, error };
  }

  if (!callbackOutcome.success) {
    if (!disposeOutcome.success) {
      throw combineOperationAndDisposeErrors(callbackOutcome.error, disposeOutcome.error);
    }

    throw toApplicationError(callbackOutcome.error);
  }

  if (!disposeOutcome.success) {
    throw toApplicationError(disposeOutcome.error);
  }

  return callbackOutcome.value;
}

export function defineTooldeckApplicationAdapters(
  adapters: TooldeckApplicationAdapters,
): TooldeckApplicationAdapters {
  return adapters;
}

function combineOperationAndDisposeErrors(
  operationError: unknown,
  disposeError: unknown,
): ApplicationError {
  const primaryError = toApplicationError(operationError);
  const cleanupError = toApplicationError(disposeError);
  const cleanupTransport = toApplicationErrorTransport(cleanupError);

  return new ApplicationError({
    source: primaryError.source,
    code: primaryError.code,
    message: primaryError.message,
    cause: new AggregateError(
      [operationError, disposeError],
      "Tooldeck application operation failed and resources did not dispose cleanly.",
      { cause: operationError },
    ),
    details: {
      ...primaryError.details,
      cleanupFailure: {
        tag: cleanupTransport.tag,
        source: cleanupTransport.source,
        code: cleanupTransport.code,
        message: cleanupTransport.message,
        ...(cleanupTransport.details ? { details: cleanupTransport.details } : {}),
      },
    },
  });
}
