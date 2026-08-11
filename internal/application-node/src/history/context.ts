import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type { ApplicationCommandRun, ListApplicationCommandRunsRequest } from "@/history/types";

export interface HistoryService {
  listCommandRuns(
    request?: ListApplicationCommandRunsRequest,
  ): ApplicationEffect<ApplicationCommandRun[]>;
}

export class History extends Context.Tag("@tooldeck/application-node/History")<
  History,
  HistoryService
>() {}
