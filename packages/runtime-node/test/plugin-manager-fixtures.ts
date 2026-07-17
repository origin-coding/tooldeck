import type { PluginManifest } from "@tooldeck/protocol";

import { ManifestIndex } from "../src";
import type { PluginHost, PluginHostActivateOptions } from "../src";

export function createManifest(id: string, commandIds: string[] = []): PluginManifest {
  return {
    schemaVersion: "1.0",
    id,
    name: id,
    version: "0.0.0",
    runtime: {
      kind: "node",
      entry: "./dist/index.js",
    },
    contributes: {
      commands: commandIds.map((commandId) => ({
        id: commandId,
        title: commandId,
      })),
    },
  };
}

export function addManifest(index: ManifestIndex, manifest: PluginManifest): void {
  index.addPluginManifest({
    manifest,
    manifestPath: `plugins/${manifest.id}/manifest.json`,
    entryPath: `plugins/${manifest.id}/dist/index.js`,
  });
}

export class TestPluginHost implements PluginHost {
  readonly activations: PluginHostActivateOptions[] = [];
  private readonly activePluginIds = new Set<string>();

  constructor(private readonly onActivate: (options: PluginHostActivateOptions) => void) {}

  hasPlugin(pluginId: string): boolean {
    return this.activePluginIds.has(pluginId);
  }

  async activatePlugin(options: PluginHostActivateOptions): Promise<void> {
    this.activations.push(options);
    this.activePluginIds.add(options.pluginId);
    this.onActivate(options);
  }
}

export class FailingPluginHost implements PluginHost {
  hasPlugin(): boolean {
    return false;
  }

  async activatePlugin(): Promise<void> {
    throw new Error("Activation failed");
  }
}
