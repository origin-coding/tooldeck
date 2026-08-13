import { runApplicationEffect } from "@/application/edge";
import type { HistoryService } from "@/history/context";
import type {
  ApplicationCommandRun,
  ApplicationHistoryFacade,
  ListApplicationCommandRunsRequest,
} from "@/history/types";

export class ApplicationHistory implements ApplicationHistoryFacade {
  constructor(private readonly service: HistoryService) {}

  listCommandRuns(
    request: ListApplicationCommandRunsRequest = {},
  ): Promise<ApplicationCommandRun[]> {
    return runApplicationEffect(this.service.listCommandRuns(request));
  }
}
