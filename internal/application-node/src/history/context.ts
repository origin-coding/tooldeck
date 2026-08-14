import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type { ApplicationCommandRun, ListApplicationCommandRunsRequest } from "@/history/types";

export class History extends Context.Tag("@tooldeck/application-node/History")<
  History,
  {
    readonly listCommandRuns: (
      request?: ListApplicationCommandRunsRequest,
    ) => ApplicationEffect<ApplicationCommandRun[]>;
  }
>() {}

export type HistoryService = Context.Tag.Service<typeof History>;
