import type { CommandResult } from "@tooldeck/protocol";

import type { TooldeckApplicationContext } from "@/application/context";
import { runApplicationEffect } from "@/application/edge";
import { type ApplicationEffect, tryApplicationSync } from "@/application/effect";
import { localizeApplicationCommand } from "@/application/localization";
import { runApplicationCommand } from "@/commands/run-command";
import type {
  ApplicationCommand,
  ApplicationCommandFacade,
  ListApplicationCommandsRequest,
  RunApplicationCommandRequest,
} from "@/commands/types";

export class ApplicationCommands implements ApplicationCommandFacade {
  constructor(private readonly context: TooldeckApplicationContext) {}

  list(request: ListApplicationCommandsRequest = {}): Promise<ApplicationCommand[]> {
    return runApplicationEffect(this.listEffect(request));
  }

  listEffect(
    request: ListApplicationCommandsRequest = {},
  ): ApplicationEffect<ApplicationCommand[]> {
    return tryApplicationSync(() => {
      const runtime = this.context.requireRuntime();
      const plugins = this.context.requirePlugins();

      return runtime.manifestIndex.listCommands().map((command) =>
        localizeApplicationCommand(
          {
            id: command.id,
            pluginId: command.pluginId,
            pluginEnabled: plugins.getById(command.pluginId)?.enabled ?? false,
            pluginRuntimeState: runtime.pluginManager.getPluginRuntimeState(command.pluginId),
            definition: command.definition,
          },
          runtime.manifestIndex.getPlugin(command.pluginId),
          request.locale,
        ),
      );
    });
  }

  run(request: RunApplicationCommandRequest): Promise<CommandResult> {
    return runApplicationEffect(runApplicationCommand(this.context, request));
  }
}
