import type { CommandDefinition, PluginManifest } from "@tooldeck/protocol";
import { TooldeckError } from "@tooldeck/shared";

export interface IndexedPlugin {
  id: string;
  manifest: PluginManifest;
  manifestPath?: string;
}

export interface IndexedCommand {
  id: string;
  pluginId: string;
  definition: CommandDefinition;
  manifestPath?: string;
}

export class ManifestIndex {
  private readonly plugins = new Map<string, IndexedPlugin>();
  private readonly commands = new Map<string, IndexedCommand>();

  addPluginManifest(manifest: PluginManifest, manifestPath?: string): void {
    if (this.plugins.has(manifest.id)) {
      throw new TooldeckError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin manifest is already indexed: ${manifest.id}`,
      });
    }

    const commands = manifest.contributes?.commands ?? [];

    for (const command of commands) {
      const existing = this.commands.get(command.id);

      if (existing) {
        throw new TooldeckError({
          code: "ERR_ALREADY_EXISTS",
          message: `Command id conflict: ${command.id}`,
          details: {
            commandId: command.id,
            existingPluginId: existing.pluginId,
            incomingPluginId: manifest.id,
          },
        });
      }
    }

    this.plugins.set(manifest.id, {
      id: manifest.id,
      manifest,
      manifestPath,
    });

    for (const command of commands) {
      this.commands.set(command.id, {
        id: command.id,
        pluginId: manifest.id,
        definition: command,
        manifestPath,
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
