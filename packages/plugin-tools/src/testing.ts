import type { CommandResult, PluginManifest } from "@tooldeck/protocol";
import { normalizeCommandResult } from "@tooldeck/sdk-node";

type MaybePromise<T> = T | Promise<T>;

export type PluginTestCommandInputMap = object;

export interface PluginTestDisposable {
  dispose(): MaybePromise<void>;
}

export type PluginTestCommandHandler<TInput = unknown> = (
  input: TInput,
) => MaybePromise<CommandResult>;

export interface PluginTestCommandRegistry<
  TCommandInputs extends PluginTestCommandInputMap = Record<string, unknown>,
> {
  register<TCommandId extends keyof TCommandInputs & string>(
    commandId: TCommandId,
    handler: PluginTestCommandHandler<TCommandInputs[TCommandId]>,
  ): PluginTestDisposable;
}

export interface PluginTestStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): void;
  snapshot(): Record<string, unknown>;
}

export type PluginTestLogLevel = "debug" | "info" | "warn" | "error";

export interface PluginTestLogEntry {
  level: PluginTestLogLevel;
  message: string;
  args: unknown[];
}

export interface PluginTestLogger {
  readonly entries: PluginTestLogEntry[];
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  clear(): void;
}

export interface PluginTestContext<
  TCommandInputs extends PluginTestCommandInputMap = Record<string, unknown>,
> {
  pluginId: string;
  subscriptions: PluginTestDisposable[];
  commands: PluginTestCommandRegistry<TCommandInputs>;
  storage: PluginTestStorage;
  logger: PluginTestLogger;
}

export interface PluginTestPlugin<
  TCommandInputs extends PluginTestCommandInputMap = Record<string, unknown>,
> {
  activate(ctx: PluginTestContext<TCommandInputs>): MaybePromise<void>;
  deactivate?(ctx: PluginTestContext<TCommandInputs>): MaybePromise<void>;
}

export interface CreatePluginTestHostOptions {
  manifest?: PluginManifest;
  pluginId?: string;
  storage?: Record<string, unknown>;
}

export interface PluginTestHost<
  TCommandInputs extends PluginTestCommandInputMap = Record<string, unknown>,
> {
  readonly context: PluginTestContext<TCommandInputs>;
  readonly storage: PluginTestStorage;
  readonly logger: PluginTestLogger;
  readonly commands: string[];
  registerCommand<TCommandId extends keyof TCommandInputs & string>(
    commandId: TCommandId,
    handler: PluginTestCommandHandler<TCommandInputs[TCommandId]>,
  ): PluginTestDisposable;
  runCommand<TCommandId extends keyof TCommandInputs & string>(
    commandId: TCommandId,
    input: TCommandInputs[TCommandId],
  ): Promise<CommandResult>;
  dispose(): Promise<void>;
}

export async function createPluginTestHost<
  TCommandInputs extends PluginTestCommandInputMap = Record<string, unknown>,
>(
  plugin: PluginTestPlugin<TCommandInputs>,
  manifestOrOptions: PluginManifest | CreatePluginTestHostOptions = {},
): Promise<PluginTestHost<TCommandInputs>> {
  const options = normalizeCreateHostOptions(manifestOrOptions);
  const commandHandlers = new Map<string, PluginTestCommandHandler<unknown>>();
  const storage = createPluginTestStorage(options.storage);
  const logger = createPluginTestLogger();
  const context: PluginTestContext<TCommandInputs> = {
    pluginId: options.pluginId ?? options.manifest?.id ?? "test.plugin",
    subscriptions: [],
    commands: {
      register(commandId, handler) {
        if (commandHandlers.has(commandId)) {
          throw new Error(`Command already registered: ${commandId}`);
        }

        commandHandlers.set(commandId, handler as PluginTestCommandHandler<unknown>);

        return createDisposable(async () => {
          commandHandlers.delete(commandId);
        });
      },
    },
    storage,
    logger,
  };
  let disposed = false;

  await plugin.activate(context);

  return {
    context,
    storage,
    logger,
    get commands() {
      return [...commandHandlers.keys()].sort();
    },
    registerCommand(commandId, handler) {
      return context.commands.register(commandId, handler);
    },
    async runCommand(commandId, input) {
      if (disposed) {
        throw new Error("Plugin test host has been disposed.");
      }

      const handler = commandHandlers.get(commandId);

      if (!handler) {
        throw new Error(`Command is not registered: ${commandId}`);
      }

      return normalizeCommandResult({ commandId, result: await handler(input) });
    },
    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      try {
        await plugin.deactivate?.(context);
      } finally {
        try {
          await disposeSubscriptions(context.subscriptions);
        } finally {
          commandHandlers.clear();
        }
      }
    },
  };
}

function normalizeCreateHostOptions(
  manifestOrOptions: PluginManifest | CreatePluginTestHostOptions,
): CreatePluginTestHostOptions {
  if (isPluginManifest(manifestOrOptions)) {
    return { manifest: manifestOrOptions };
  }

  return manifestOrOptions;
}

function createPluginTestStorage(initialValues: Record<string, unknown> = {}): PluginTestStorage {
  const values = new Map(Object.entries(initialValues));

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
    clear() {
      values.clear();
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

function createPluginTestLogger(): PluginTestLogger {
  const entries: PluginTestLogEntry[] = [];
  const logger = {
    entries,
    debug(message: string, ...args: unknown[]) {
      entries.push({ level: "debug", message, args });
    },
    info(message: string, ...args: unknown[]) {
      entries.push({ level: "info", message, args });
    },
    warn(message: string, ...args: unknown[]) {
      entries.push({ level: "warn", message, args });
    },
    error(message: string, ...args: unknown[]) {
      entries.push({ level: "error", message, args });
    },
    clear() {
      entries.splice(0);
    },
  } satisfies PluginTestLogger;

  return logger;
}

function createDisposable(dispose: () => MaybePromise<void>): PluginTestDisposable {
  let disposed = false;

  return {
    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      await dispose();
    },
  };
}

async function disposeSubscriptions(subscriptions: PluginTestDisposable[]): Promise<void> {
  const errors: unknown[] = [];

  for (const subscription of subscriptions.toReversed()) {
    try {
      await subscription.dispose();
    } catch (error) {
      errors.push(error);
    }
  }

  subscriptions.splice(0);

  if (errors.length === 1) {
    throw errors[0];
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, "Failed to dispose plugin test subscriptions.");
  }
}

function isPluginManifest(value: unknown): value is PluginManifest {
  return isRecord(value) && value.schemaVersion === "1.0" && typeof value.id === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
