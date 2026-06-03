import type { MaybePromise } from "@tooldeck/shared";

import type { CommandHandler, CommandInput, CommandInputMap } from "./commands";
import type { PluginContextV1 } from "./context";
import type { Disposable } from "./disposable";

export interface ToolboxPluginV1<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  activate(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
  deactivate?(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
}

export type ToolboxPlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> =
  ToolboxPluginV1<TCommandInputs>;

export type PluginLifecycleHandler<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> = (ctx: PluginContextV1<TCommandInputs>) => MaybePromise<void>;

export type PluginCommandHandlers<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> = Partial<{
  [TCommandId in keyof TCommandInputs & string]: CommandHandler<TCommandInputs[TCommandId]>;
}>;

export interface PluginDefinition<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  commands?: PluginCommandHandlers<TCommandInputs>;
  onActivate?: PluginLifecycleHandler<TCommandInputs>;
  onDeactivate?: PluginLifecycleHandler<TCommandInputs>;
}

export interface PluginBuilder<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  command<TCommandId extends keyof TCommandInputs & string>(
    commandId: TCommandId,
    handler: CommandHandler<TCommandInputs[TCommandId]>,
  ): void;
  onActivate(handler: PluginLifecycleHandler<TCommandInputs>): void;
  onDeactivate(handler: PluginLifecycleHandler<TCommandInputs>): void;
}

export type PluginSetup<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> = (
  plugin: PluginBuilder<TCommandInputs>,
) => MaybePromise<void>;

type RegisteredCommand = {
  commandId: string;
  handler: CommandHandler<CommandInput>;
};

type RuntimeCommandRegistry = {
  register(commandId: string, handler: CommandHandler<CommandInput>): Disposable;
};

type NormalizedPluginDefinition<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> = {
  commands: RegisteredCommand[];
  onActivate: PluginLifecycleHandler<TCommandInputs>[];
  onDeactivate: PluginLifecycleHandler<TCommandInputs>[];
};

export function definePlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  setup: PluginSetup<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs>;
export function definePlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  definition: PluginDefinition<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs>;
export function definePlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  plugin: ToolboxPluginV1<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs>;
export function definePlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  input:
    | PluginSetup<TCommandInputs>
    | PluginDefinition<TCommandInputs>
    | ToolboxPluginV1<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs> {
  if (typeof input === "function") {
    return defineBuilderPlugin(input);
  }

  if ("activate" in input && typeof input.activate === "function") {
    return input;
  }

  return defineObjectPlugin(input as PluginDefinition<TCommandInputs>);
}

function defineBuilderPlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  setup: PluginSetup<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs> {
  let definition: NormalizedPluginDefinition<TCommandInputs> | undefined;

  return {
    async activate(ctx) {
      definition = createNormalizedPluginDefinition<TCommandInputs>();
      await setup(createPluginBuilder(definition));
      await activateDefinition(ctx, definition);
    },
    async deactivate(ctx) {
      if (!definition) {
        return;
      }

      await deactivateDefinition(ctx, definition);
    },
  };
}

function defineObjectPlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  definition: PluginDefinition<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs> {
  const normalizedDefinition = createNormalizedPluginDefinition(definition);

  return {
    async activate(ctx) {
      await activateDefinition(ctx, normalizedDefinition);
    },
    async deactivate(ctx) {
      await deactivateDefinition(ctx, normalizedDefinition);
    },
  };
}

function createPluginBuilder<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  definition: NormalizedPluginDefinition<TCommandInputs>,
): PluginBuilder<TCommandInputs> {
  return {
    command(commandId, handler) {
      definition.commands.push({
        commandId,
        handler: handler as CommandHandler<CommandInput>,
      });
    },
    onActivate(handler) {
      definition.onActivate.push(handler);
    },
    onDeactivate(handler) {
      definition.onDeactivate.push(handler);
    },
  };
}

function createNormalizedPluginDefinition<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
>(definition?: PluginDefinition<TCommandInputs>): NormalizedPluginDefinition<TCommandInputs> {
  return {
    commands: definition?.commands ? normalizeCommands(definition.commands) : [],
    onActivate: definition?.onActivate ? [definition.onActivate] : [],
    onDeactivate: definition?.onDeactivate ? [definition.onDeactivate] : [],
  };
}

function normalizeCommands<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  commands: PluginCommandHandlers<TCommandInputs>,
): RegisteredCommand[] {
  return Object.entries(commands).map(([commandId, handler]) => ({
    commandId,
    handler: handler as CommandHandler<CommandInput>,
  }));
}

async function activateDefinition<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
>(
  ctx: PluginContextV1<TCommandInputs>,
  definition: NormalizedPluginDefinition<TCommandInputs>,
): Promise<void> {
  for (const onActivate of definition.onActivate) {
    await onActivate(ctx);
  }

  for (const command of definition.commands) {
    ctx.subscriptions.push(
      (ctx.commands as RuntimeCommandRegistry).register(command.commandId, command.handler),
    );
  }
}

async function deactivateDefinition<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
>(
  ctx: PluginContextV1<TCommandInputs>,
  definition: NormalizedPluginDefinition<TCommandInputs>,
): Promise<void> {
  for (const onDeactivate of definition.onDeactivate.toReversed()) {
    await onDeactivate(ctx);
  }
}
