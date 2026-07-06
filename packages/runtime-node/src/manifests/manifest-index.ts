import type { CommandDefinition, PluginManifest } from "@tooldeck/protocol";
import { TooldeckError } from "@tooldeck/shared";

import type { PluginScanSource } from "../plugins/plugin-scanner";

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
  manifest: PluginManifest;
  manifestPath: string;
  entryPath: string;
  source?: PluginScanSource;
}

export class ManifestIndex {
  private readonly plugins = new Map<string, IndexedPlugin>();
  private readonly commands = new Map<string, IndexedCommand>();

  addPluginManifest(options: AddPluginManifestOptions): void {
    const { manifest, manifestPath, entryPath } = options;
    const source = options.source ?? { kind: "builtin" as const, path: "" };

    const existingPlugin = this.plugins.get(manifest.id);

    if (existingPlugin) {
      throw new TooldeckError({
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
        throw new TooldeckError({
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

    this.plugins.set(manifest.id, {
      id: manifest.id,
      manifest,
      manifestPath,
      entryPath,
      source,
    });

    for (const command of commands) {
      this.commands.set(command.id, {
        id: command.id,
        pluginId: manifest.id,
        definition: command,
        manifestPath,
        entryPath,
        source,
      });
    }
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
}
