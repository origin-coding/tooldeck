import type { CommandResult } from "@tooldeck/protocol";

import { runApplicationEffect } from "@/application/edge";
import type { CommandsService } from "@/commands/context";
import type {
  ApplicationCommand,
  ApplicationCommandFacade,
  ListApplicationCommandsRequest,
  RunApplicationCommandRequest,
} from "@/commands/types";

export class ApplicationCommands implements ApplicationCommandFacade {
  constructor(private readonly service: CommandsService) {}

  list(request: ListApplicationCommandsRequest = {}): Promise<ApplicationCommand[]> {
    return runApplicationEffect(this.service.list(request));
  }

  run(request: RunApplicationCommandRequest): Promise<CommandResult> {
    return runApplicationEffect(this.service.run(request));
  }
}
