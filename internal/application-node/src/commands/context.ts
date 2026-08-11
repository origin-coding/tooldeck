import type { CommandResult } from "@tooldeck/protocol";
import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  ApplicationCommand,
  ListApplicationCommandsRequest,
  RunApplicationCommandRequest,
} from "@/commands/types";

export interface CommandsService {
  list(request?: ListApplicationCommandsRequest): ApplicationEffect<ApplicationCommand[]>;
  run(request: RunApplicationCommandRequest): ApplicationEffect<CommandResult>;
}

export class Commands extends Context.Tag("@tooldeck/application-node/Commands")<
  Commands,
  CommandsService
>() {}
