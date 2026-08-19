import path from "node:path";

import type {
  CommandDefinition,
  CommandResult,
  JsonObject,
  PluginManifest,
} from "@tooldeck/protocol";

import type { CommandInputCoercion } from "@/commands/input";
import { RuntimeError } from "@/errors/error";
import {
  RuntimeJsonSchema,
  type RuntimeCommandSchemaValidators,
} from "@/json-schema/runtime-json-schema";
import type { PluginScanSource } from "@/plugins/scanner";

export interface IndexedPlugin {
  id: string;
  manifest: PluginManifest;
  manifestPath: string;
  entryPath: string;
  source: PluginScanSource;
}

export interface IndexedCommand {
  id: string;
  pluginId: string;
  definition: CommandDefinition;
  manifestPath: string;
  entryPath: string;
  source: PluginScanSource;
}

export interface AddPluginManifestOptions {
  manifest: unknown;
  manifestPath: string;
  entryPath?: string;
  source?: PluginScanSource;
}

export class ManifestIndex {
  private readonly plugins = new Map<string, IndexedPlugin>();
  private readonly commands = new Map<string, IndexedCommand>();
  private readonly commandSchemas = new Map<string, RuntimeCommandSchemaValidators>();
  private schemas: RuntimeJsonSchema | undefined = new RuntimeJsonSchema();

  addPluginManifest(options: AddPluginManifestOptions): PluginManifest {
    const { manifestPath } = options;
    const schemas = this.requireSchemas();
    const manifest = schemas.validateManifest(options.manifest, manifestPath);
    const entryPath =
      options.entryPath ?? path.resolve(path.dirname(manifestPath), manifest.runtime.entry);
    const source = options.source ?? { kind: "builtin" as const, path: "" };

    const existingPlugin = this.plugins.get(manifest.id);

    if (existingPlugin) {
      throw new RuntimeError({
        code: "ERR_ALREADY_EXISTS",
        message: [
          `Plugin manifest is already indexed: ${manifest.id}`,
          `Existing source: ${existingPlugin.source.kind}`,
          `Incoming source: ${source.kind}`,
        ].join("\n"),
        details: {
          duplicateKind: "plugin",
          pluginId: manifest.id,
          existingPluginId: existingPlugin.id,
          incomingPluginId: manifest.id,
          existingSourceKind: existingPlugin.source.kind,
          incomingSourceKind: source.kind,
          existingManifestPath: existingPlugin.manifestPath,
          incomingManifestPath: manifestPath,
        },
      });
    }

    const commands = manifest.contributes?.commands ?? [];

    for (const command of commands) {
      const existing = this.commands.get(command.id);

      if (existing) {
        throw new RuntimeError({
          code: "ERR_ALREADY_EXISTS",
          message: [
            `Command id conflict: ${command.id}`,
            `Existing source: ${existing.source.kind}`,
            `Existing plugin: ${existing.pluginId}`,
            `Incoming source: ${source.kind}`,
            `Incoming plugin: ${manifest.id}`,
          ].join("\n"),
          details: {
            duplicateKind: "command",
            commandId: command.id,
            existingPluginId: existing.pluginId,
            incomingPluginId: manifest.id,
            existingSourceKind: existing.source.kind,
            incomingSourceKind: source.kind,
            existingManifestPath: existing.manifestPath,
            incomingManifestPath: manifestPath,
          },
        });
      }
    }

    const commandSchemas = commands.map((command, commandIndex) =>
      schemas.compileCommand(command, commandIndex, manifestPath),
    );

    this.plugins.set(manifest.id, {
      id: manifest.id,
      manifest,
      manifestPath,
      entryPath,
      source,
    });

    commands.forEach((command, commandIndex) => {
      this.commands.set(command.id, {
        id: command.id,
        pluginId: manifest.id,
        definition: command,
        manifestPath,
        entryPath,
        source,
      });
      this.commandSchemas.set(command.id, commandSchemas[commandIndex]!);
    });

    return manifest;
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  getPlugin(pluginId: string): IndexedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): IndexedPlugin[] {
    return [...this.plugins.values()];
  }

  hasCommand(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  getCommand(commandId: string): IndexedCommand | undefined {
    return this.commands.get(commandId);
  }

  listCommands(): IndexedCommand[] {
    return [...this.commands.values()];
  }

  getCommandOwner(commandId: string): string | undefined {
    return this.commands.get(commandId)?.pluginId;
  }

  normalizeCommandInput(options: {
    commandId: string;
    input: unknown;
    coercion: CommandInputCoercion;
  }): JsonObject {
    const validators = this.commandSchemas.get(options.commandId);

    if (!validators) {
      throw new RuntimeError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not contributed by any plugin: ${options.commandId}`,
      });
    }

    return this.requireSchemas().normalizeCommandInput({
      validators,
      input: options.input,
      commandId: options.commandId,
      coercion: options.coercion,
    });
  }

  validateCommandOutput(options: { commandId: string; result: CommandResult }): void {
    const validators = this.commandSchemas.get(options.commandId);

    if (!validators) {
      throw new RuntimeError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not contributed by any plugin: ${options.commandId}`,
      });
    }

    this.requireSchemas().validateCommandOutput({
      validator: validators.output,
      result: options.result,
      commandId: options.commandId,
    });
  }

  dispose(): void {
    this.commandSchemas.clear();
    this.commands.clear();
    this.plugins.clear();
    this.schemas = undefined;
  }

  private requireSchemas(): RuntimeJsonSchema {
    if (this.schemas) {
      return this.schemas;
    }

    throw new RuntimeError({
      code: "ERR_INVALID_ARGUMENT",
      message: "Manifest index has been disposed",
    });
  }
}
