import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { ManifestIndex } from "../src";

function createManifest(id: string, commandIds: string[] = []): PluginManifest {
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

describe("ManifestIndex", () => {
  it("indexes plugin manifests and command contributions", () => {
    const index = new ManifestIndex();
    const manifest = createManifest("dev.example.json-tools", ["json.format", "json.validate"]);

    index.addPluginManifest({
      manifest,
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    expect(index.hasPlugin("dev.example.json-tools")).toBe(true);
    expect(index.listPlugins()).toHaveLength(1);
    expect(index.listCommands()).toHaveLength(2);
    expect(index.hasCommand("json.format")).toBe(true);
    expect(index.getCommandOwner("json.format")).toBe("dev.example.json-tools");
    expect(index.getCommand("json.format")).toMatchObject({
      id: "json.format",
      pluginId: "dev.example.json-tools",
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });
  });

  it("indexes manifests without commands", () => {
    const index = new ManifestIndex();
    const manifest = createManifest("dev.example.empty");

    index.addPluginManifest({
      manifest,
      manifestPath: "plugins/empty/manifest.json",
      entryPath: "plugins/empty/dist/index.js",
    });

    expect(index.hasPlugin("dev.example.empty")).toBe(true);
    expect(index.listCommands()).toHaveLength(0);
  });

  it("throws when indexing a duplicate plugin id", () => {
    const index = new ManifestIndex();
    const manifest = createManifest("dev.example.json-tools", ["json.format"]);

    index.addPluginManifest({
      manifest,
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    expect(() =>
      index.addPluginManifest({
        manifest: createManifest("dev.example.json-tools"),
        manifestPath: "plugins/json-tools-copy/manifest.json",
        entryPath: "plugins/json-tools-copy/dist/index.js",
      }),
    ).toThrow("Plugin manifest is already indexed: dev.example.json-tools");
  });

  it("throws when indexing duplicate command ids across plugins", () => {
    const index = new ManifestIndex();

    index.addPluginManifest({
      manifest: createManifest("dev.example.json-tools", ["json.format"]),
      manifestPath: "plugins/json-tools/manifest.json",
      entryPath: "plugins/json-tools/dist/index.js",
    });

    expect(() =>
      index.addPluginManifest({
        manifest: createManifest("dev.example.other-json-tools", ["json.format"]),
        manifestPath: "plugins/other-json-tools/manifest.json",
        entryPath: "plugins/other-json-tools/dist/index.js",
      }),
    ).toThrow("Command id conflict: json.format");
  });
});
