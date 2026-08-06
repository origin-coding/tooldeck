import type { PluginManifest } from "@tooldeck/protocol";
import { Effect } from "effect";

import { ManifestIndex, PluginHostRegistry } from "@/index";
import type { PluginHost, PluginHostActivateOptions } from "@/index";

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
  readonly kind = "node";
  readonly activations: PluginHostActivateOptions[] = [];
  private readonly activePluginIds = new Set<string>();

  constructor(private readonly onActivate: (options: PluginHostActivateOptions) => void) {}

  hasPlugin(pluginId: string): boolean {
    return this.activePluginIds.has(pluginId);
  }

  activatePlugin(options: PluginHostActivateOptions) {
    return Effect.sync(() => {
      this.activations.push(options);
      this.activePluginIds.add(options.pluginId);
      this.onActivate(options);
    });
  }

  deactivatePlugin(pluginId: string) {
    return Effect.sync(() => {
      this.activePluginIds.delete(pluginId);
    });
  }

  dispose() {
    return Effect.sync(() => {
      this.activePluginIds.clear();
    });
  }
}

export class FailingPluginHost implements PluginHost {
  readonly kind = "node";

  hasPlugin(): boolean {
    return false;
  }

  activatePlugin() {
    return Effect.die(new Error("Activation failed"));
  }

  deactivatePlugin() {
    return Effect.void;
  }

  dispose() {
    return Effect.void;
  }
}

export function createHostRegistry(host: PluginHost): PluginHostRegistry {
  const hostRegistry = new PluginHostRegistry();

  hostRegistry.register(host);

  return hostRegistry;
}
