import { performance } from "node:perf_hooks";

import type { CommandResult } from "@tooldeck/protocol";

import type {
  CommandRunRecord,
  ListCommandRunsRequest,
  RunCommandRequest,
} from "@/shared/desktop-api";

import { TooldeckDesktopServiceContext } from "./context";
import type { DesktopCommandRunService } from "./types";

export class TooldeckDesktopCommandRunService implements DesktopCommandRunService {
  constructor(private readonly context: TooldeckDesktopServiceContext) {}

  async runCommand(request: RunCommandRequest): Promise<CommandResult> {
    const commandRuns = this.context.requireCommandRuns();
    const manifestIndex = this.context.requireManifestIndex();
    const startedAt = performance.now();
    const pluginId = manifestIndex.getCommandOwner(request.commandId);

    try {
      this.assertCommandPluginEnabled(request.commandId, pluginId);

      const run = await this.context.requireCommandService().runCommand({
        commandId: request.commandId,
        input: request.input,
      });

      commandRuns.create({
        commandId: request.commandId,
        pluginId,
        source: "desktop",
        status: run.result.status,
        input: run.input,
        output: run.result,
        durationMs: elapsedMilliseconds(startedAt),
      });

      return run.result;
    } catch (error) {
      commandRuns.create({
        commandId: request.commandId,
        pluginId,
        source: "desktop",
        status: "error",
        input: request.input,
        error: serializeError(error),
        durationMs: elapsedMilliseconds(startedAt),
      });

      throw error;
    }
  }

  listCommandRuns(request: ListCommandRunsRequest = {}): CommandRunRecord[] {
    return this.context
      .requireCommandRuns()
      .listRecent(request)
      .map((row) => ({
        id: row.id,
        commandId: row.commandId,
        pluginId: row.pluginId ?? undefined,
        source: row.source,
        status: row.status as CommandResult["status"],
        input: parseJson(row.inputJson),
        output: parseJson(row.outputJson) as CommandResult | undefined,
        error: parseJson(row.errorJson),
        durationMs: row.durationMs ?? undefined,
        createdAt: row.createdAt,
      }));
  }

  private assertCommandPluginEnabled(commandId: string, pluginId: string | undefined): void {
    if (!pluginId) {
      return;
    }

    const plugin = this.context.requirePlugins().getById(pluginId);

    if (!plugin?.enabled) {
      throw new Error(`Plugin is disabled for command ${commandId}: ${pluginId}`);
    }
  }
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function parseJson(value: string | null): unknown {
  if (value === null) {
    return undefined;
  }

  return JSON.parse(value);
}
