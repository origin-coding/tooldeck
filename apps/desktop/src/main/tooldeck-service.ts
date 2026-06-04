import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  CommandRegistry,
  CommandService,
  ManifestIndex,
  PluginManager,
  scanPluginDirectory,
  type IndexedCommand,
} from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
  type TooldeckDatabase,
} from "@tooldeck/storage";

import type { CommandRunRecord, DesktopCommand, RunCommandRequest } from "../shared/desktop-api";

export interface TooldeckDesktopServiceOptions {
  workspaceRoot?: string;
  pluginsRoot?: string;
  storagePath?: string;
}

export class TooldeckDesktopService {
  private readonly workspaceRoot: string;
  private readonly pluginsRoot: string;
  private readonly storagePath: string;
  private database?: TooldeckDatabase;
  private commandRuns?: CommandRunRepository;
  private plugins?: PluginRepository;
  private pluginKv?: PluginKvRepository;
  private pluginHost?: NodePluginHost;
  private commandService?: CommandService;
  private manifestIndex?: ManifestIndex;

  constructor(options: TooldeckDesktopServiceOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
    this.pluginsRoot = options.pluginsRoot ?? path.join(this.workspaceRoot, "plugins");
    this.storagePath = options.storagePath ?? path.join(this.workspaceRoot, ".data", "tooldeck.sqlite");
  }

  async start(): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });

    this.database = openTooldeckDatabase({ path: this.storagePath });
    this.commandRuns = new CommandRunRepository(this.database.db);
    this.plugins = new PluginRepository(this.database.db);
    this.pluginKv = new PluginKvRepository(this.database.db);

    await this.scanAndCreateRuntime();
  }

  listCommands(): DesktopCommand[] {
    return this.requireManifestIndex().listCommands().map(formatDesktopCommand);
  }

  async runCommand(request: RunCommandRequest): Promise<CommandResult> {
    const commandRuns = this.requireCommandRuns();
    const manifestIndex = this.requireManifestIndex();
    const startedAt = performance.now();
    const pluginId = manifestIndex.getCommandOwner(request.commandId);

    try {
      const run = await this.requireCommandService().runCommand({
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

  listCommandRuns(limit = 50): CommandRunRecord[] {
    return this.requireCommandRuns().listRecent(limit).map((row) => ({
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

  async dispose(): Promise<void> {
    try {
      await this.pluginHost?.disposeAll();
    } finally {
      this.database?.close();
    }
  }

  private async scanAndCreateRuntime(): Promise<void> {
    const commandRegistry = new CommandRegistry();
    const manifestIndex = new ManifestIndex();
    const pluginKv = this.requirePluginKv();

    const pluginHost = new NodePluginHost({
      commandRegistry,
      createPluginStorage(pluginId) {
        return {
          async get(key) {
            return pluginKv.get(pluginId, key);
          },
          async set(key, value) {
            pluginKv.set({
              pluginId,
              key,
              value,
            });
          },
          async delete(key) {
            pluginKv.delete(pluginId, key);
          },
        };
      },
    });

    await scanPluginDirectory({
      pluginsRoot: this.pluginsRoot,
      manifestIndex,
    });

    for (const plugin of manifestIndex.listPlugins()) {
      this.requirePlugins().upsertScannedPlugin({
        manifest: plugin.manifest,
        manifestPath: plugin.manifestPath,
      });
    }

    const pluginManager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    this.pluginHost = pluginHost;
    this.manifestIndex = manifestIndex;
    this.commandService = new CommandService({
      pluginManager,
      coercion: "none",
    });
  }

  private requireCommandService(): CommandService {
    if (!this.commandService) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandService;
  }

  private requireManifestIndex(): ManifestIndex {
    if (!this.manifestIndex) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.manifestIndex;
  }

  private requireCommandRuns(): CommandRunRepository {
    if (!this.commandRuns) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandRuns;
  }

  private requirePlugins(): PluginRepository {
    if (!this.plugins) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.plugins;
  }

  private requirePluginKv(): PluginKvRepository {
    if (!this.pluginKv) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.pluginKv;
  }
}

function formatDesktopCommand(command: IndexedCommand): DesktopCommand {
  return {
    id: command.id,
    pluginId: command.pluginId,
    title: resolveLocalizedString(command.definition.title),
    description: command.definition.description
      ? resolveLocalizedString(command.definition.description)
      : undefined,
    inputSchema: command.definition.inputSchema,
  };
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
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

function findWorkspaceRoot(): string {
  let current = process.cwd();

  for (;;) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
