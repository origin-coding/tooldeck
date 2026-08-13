import type { CommandResult } from "@tooldeck/protocol";
import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  ApplicationCommand,
  ListApplicationCommandsRequest,
  RunApplicationCommandRequest,
} from "@/commands/types";

export class Commands extends Context.Tag("@tooldeck/application-node/Commands")<
  Commands,
  {
    readonly list: (
      request?: ListApplicationCommandsRequest,
    ) => ApplicationEffect<ApplicationCommand[]>;
    readonly run: (request: RunApplicationCommandRequest) => ApplicationEffect<CommandResult>;
  }
>() {}

export type CommandsService = Context.Tag.Service<typeof Commands>;
