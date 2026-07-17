import { describe, expect, it } from "vitest";

import { openTooldeckDatabase, PluginKvRepository, PreferenceRepository } from "../src";
import type { PreferenceRow } from "../src";
import { createDatabasePath } from "./storage-test-fixtures";

describe("plugin and preference values", () => {
  it("stores plugin KV values scoped by plugin id", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginKvRepository(database.db);

      repository.set({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        value: 2,
        now: 1000,
      });
      repository.set({
        pluginId: "dev.tooldeck.other",
        key: "indent",
        value: 4,
        now: 1000,
      });
      repository.set({
        pluginId: "dev.tooldeck.json-tools",
        key: "theme",
        value: "dark",
        now: 1000,
      });
      const updated = repository.set({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        value: {
          size: 8,
        },
        now: 2000,
      });

      expect(repository.get("dev.tooldeck.json-tools", "indent")).toEqual({ size: 8 });
      expect(repository.get("dev.tooldeck.other", "indent")).toBe(4);
      expect(repository.list().map((entry) => `${entry.pluginId}:${entry.key}`)).toEqual([
        "dev.tooldeck.json-tools:indent",
        "dev.tooldeck.json-tools:theme",
        "dev.tooldeck.other:indent",
      ]);
      expect(updated).toMatchObject({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        valueJson: JSON.stringify({ size: 8 }),
        updatedAt: 2000,
      });

      repository.delete("dev.tooldeck.json-tools", "indent");

      expect(repository.get("dev.tooldeck.json-tools", "indent")).toBeUndefined();
      expect(repository.get("dev.tooldeck.other", "indent")).toBe(4);

      expect(repository.deleteByPlugin("dev.tooldeck.json-tools")).toEqual([
        expect.objectContaining({ key: "theme" }),
      ]);
      expect(repository.listByPlugin("dev.tooldeck.json-tools")).toEqual([]);
      expect(repository.deleteByPlugin("dev.tooldeck.json-tools")).toEqual([]);
      expect(repository.get("dev.tooldeck.other", "indent")).toBe(4);
    } finally {
      database.close();
    }
  });

  it("rejects plugin KV values that are not JSON serializable", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginKvRepository(database.db);

      expect(() =>
        repository.set({
          pluginId: "dev.tooldeck.json-tools",
          key: "invalid",
          value: undefined,
        }),
      ).toThrow("Plugin KV value must be JSON serializable");
    } finally {
      database.close();
    }
  });

  it("stores preferences scoped by app or shared namespace", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      repository.set({
        scope: "desktop",
        key: "theme",
        value: "system",
        now: 1000,
      });
      repository.set({
        scope: "cli",
        key: "theme",
        value: "dark",
        now: 1000,
      });
      const updated = repository.set({
        scope: "desktop",
        key: "theme",
        value: "light",
        now: 2000,
      });

      expect(repository.get("desktop", "theme")).toBe("light");
      expect(repository.get("cli", "theme")).toBe("dark");
      expect(repository.get("shared", "theme")).toBeUndefined();
      expect(updated).toMatchObject({
        scope: "desktop",
        key: "theme",
        valueJson: JSON.stringify("light"),
        updatedAt: 2000,
      });
      expect(repository.list("desktop").map((row: PreferenceRow) => row.key)).toEqual(["theme"]);
    } finally {
      database.close();
    }
  });

  it("deletes preferences by scope and key", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      repository.set({
        scope: "desktop",
        key: "sidebarCollapsed",
        value: true,
      });
      repository.delete("desktop", "sidebarCollapsed");

      expect(repository.get("desktop", "sidebarCollapsed")).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it("rejects preferences that are not JSON serializable", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      expect(() =>
        repository.set({
          scope: "desktop",
          key: "invalid",
          value: undefined,
        }),
      ).toThrow("Preference value must be JSON serializable");
    } finally {
      database.close();
    }
  });
});
