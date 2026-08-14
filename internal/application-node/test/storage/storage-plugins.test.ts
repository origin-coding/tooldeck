import { describe, expect, it } from "vitest";

import { createPluginManifest, withTestStorage } from "./storage-test-fixtures";

describe("plugin storage records", () => {
  it("upserts scanned plugins and preserves enabled state", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.plugins;

      repository.upsertScannedPlugin({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.json-tools",
          name: "JSON Tools",
          version: "0.0.1",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });
      repository.setEnabled("dev.tooldeck.json-tools", false, 1500);
      const updated = repository.upsertScannedPlugin({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.json-tools",
          name: {
            key: "plugin.name",
            default: "JSON Tools",
          },
          version: "0.0.2",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
        manifestPath: "plugins/json-tools/manifest.json",
        now: 2000,
      });

      expect(updated).toMatchObject({
        id: "dev.tooldeck.json-tools",
        nameJson: JSON.stringify({
          key: "plugin.name",
          default: "JSON Tools",
        }),
        version: "0.0.2",
        manifestPath: "plugins/json-tools/manifest.json",
        sourceKind: "builtin",
        installDir: null,
        enabled: false,
        installedAt: 1000,
        updatedAt: 2000,
      });
      expect(repository.listEnabled()).toHaveLength(0);
      expect(repository.list()).toHaveLength(1);
    });
  });

  it("stores scanned plugin source metadata", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.plugins;

      const plugin = repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.example.installed", "Installed", "0.1.0"),
        manifestPath: "installed-plugins/dev.example.installed/manifest.json",
        sourceKind: "installed",
        installDir: "installed-plugins/dev.example.installed",
        now: 1000,
      });

      expect(plugin).toMatchObject({
        id: "dev.example.installed",
        sourceKind: "installed",
        installDir: "installed-plugins/dev.example.installed",
        enabled: true,
      });
    });
  });

  it("syncs scanned plugins and deletes plugins missing from the scan", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.plugins;

      repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.old-plugin", "Old Plugin", "0.0.1"),
        manifestPath: "plugins/old-plugin/manifest.json",
        now: 1000,
      });
      repository.setEnabled("dev.tooldeck.old-plugin", false, 1100);

      const synced = repository.syncScannedPlugins({
        now: 2000,
        plugins: [
          {
            manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
            manifestPath: "plugins/json-tools/manifest.json",
          },
          {
            manifest: createPluginManifest("dev.tooldeck.hello-world", "Hello World", "0.0.1"),
            manifestPath: "plugins/hello-world/manifest.json",
          },
        ],
      });

      expect(synced.map((plugin) => plugin.id)).toEqual([
        "dev.tooldeck.json-tools",
        "dev.tooldeck.hello-world",
      ]);
      expect(repository.list().map((plugin) => plugin.id)).toEqual([
        "dev.tooldeck.hello-world",
        "dev.tooldeck.json-tools",
      ]);
      expect(repository.getById("dev.tooldeck.old-plugin")).toBeUndefined();
    });
  });

  it("syncs an empty scan by clearing the plugin registry", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.plugins;

      repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });

      expect(repository.syncScannedPlugins({ plugins: [], now: 2000 })).toEqual([]);
      expect(repository.list()).toEqual([]);
    });
  });

  it("updates plugin enabled state by id", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.plugins;

      repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });

      expect(repository.setEnabled("dev.tooldeck.json-tools", false, 2000)).toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: false,
        installedAt: 1000,
        updatedAt: 2000,
      });
      expect(repository.setEnabled("dev.tooldeck.missing", true, 3000)).toBeUndefined();
    });
  });

  it("stores plugin enabled state outside the scanned plugin catalog", async () => {
    await withTestStorage(({ repositories }) => {
      const plugins = repositories.plugins;
      const states = repositories.pluginStates;

      plugins.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });

      expect(states.setEnabled("dev.tooldeck.json-tools", false, 2000)).toMatchObject({
        pluginId: "dev.tooldeck.json-tools",
        enabled: false,
      });
      expect(plugins.getById("dev.tooldeck.json-tools")).toMatchObject({
        enabled: false,
      });
      expect(states.delete("dev.tooldeck.json-tools")).toMatchObject({
        pluginId: "dev.tooldeck.json-tools",
      });
    });
  });

  it("creates, lists, gets, and deletes plugin install records", async () => {
    await withTestStorage(({ repositories }) => {
      const repository = repositories.pluginInstalls;

      const created = repository.create({
        pluginId: "dev.example.installed",
        version: "0.1.0",
        installDir: "installed-plugins/dev.example.installed",
        manifestPath: "installed-plugins/dev.example.installed/manifest.json",
        packageName: "dev.example.installed-0.1.0.tdplugin",
        packageDigest: "sha256:abc",
        packageSizeBytes: 1234,
        installedAt: 1000,
        updatedAt: 1000,
      });

      expect(created).toMatchObject({
        pluginId: "dev.example.installed",
        version: "0.1.0",
        packageDigest: "sha256:abc",
      });
      expect(repository.getById("dev.example.installed")).toMatchObject(created);
      expect(repository.list()).toEqual([created]);
      expect(repository.delete("dev.example.installed")).toMatchObject(created);
      expect(repository.getById("dev.example.installed")).toBeUndefined();
    });
  });
});
