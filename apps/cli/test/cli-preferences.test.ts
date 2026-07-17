import { expect, it, describe } from "vitest";

import {
  deleteCliPreference,
  getCliPreference,
  listCliPreferences,
  parsePreferenceJson,
  setCliPreference,
} from "../src/cli";
import { createDatabasePath, readPreferenceValue } from "./cli-test-fixtures";

describe("CLI preferences", () => {
  it("stores and lists known preferences with defaults", async () => {
    const storagePath = createDatabasePath();

    await expect(
      setCliPreference({
        key: "output.format",
        value: "json",
        storagePath,
      }),
    ).resolves.toMatchObject({
      scope: "cli",
      key: "output.format",
      value: "json",
      updatedAt: expect.any(Number),
    });

    await expect(
      setCliPreference({
        key: "locale",
        value: "zh-CN",
        storagePath,
      }),
    ).resolves.toMatchObject({
      scope: "shared",
      key: "locale",
      value: "zh-CN",
    });

    await expect(listCliPreferences({ storagePath })).resolves.toEqual([
      expect.objectContaining({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
      }),
      expect.objectContaining({
        scope: "cli",
        key: "output.format",
        value: "json",
      }),
      expect.objectContaining({
        scope: "cli",
        key: "command.history.enabled",
        value: true,
      }),
      expect.objectContaining({
        scope: "desktop",
        key: "navigation.mode",
        value: "provider-first",
      }),
      expect.objectContaining({
        scope: "desktop",
        key: "sidebar.collapsed",
        value: false,
      }),
    ]);
    expect(readPreferenceValue(storagePath, "cli", "output.format")).toBe("json");
    expect(readPreferenceValue(storagePath, "shared", "locale")).toBe("zh-CN");
    expect(readPreferenceValue(storagePath, "cli", "command.history.enabled")).toBeUndefined();
  });

  it("rejects unsupported preference keys and invalid values", async () => {
    const storagePath = createDatabasePath();

    await expect(
      setCliPreference({
        key: "json.indent",
        value: 4,
        storagePath,
      }),
    ).rejects.toThrow("Unsupported preference key: json.indent");

    await expect(
      setCliPreference({
        key: "output.format",
        value: "yaml",
        storagePath,
      }),
    ).rejects.toThrow("Preference output.format must be one of: text, json");

    await expect(
      setCliPreference({
        key: "command.history.enabled",
        value: "false",
        storagePath,
      }),
    ).rejects.toThrow("Preference command.history.enabled must be a boolean value");
  });

  it("deletes known preferences by scope and falls back to defaults", async () => {
    const storagePath = createDatabasePath();

    await setCliPreference({
      key: "locale",
      value: "en-US",
      storagePath,
    });
    await deleteCliPreference({
      key: "locale",
      storagePath,
    });

    await expect(
      getCliPreference({
        key: "locale",
        storagePath,
      }),
    ).resolves.toBe("system");
    expect(readPreferenceValue(storagePath, "shared", "locale")).toBeUndefined();
  });

  it("parses preference values as JSON", () => {
    expect(parsePreferenceJson('"dark"')).toBe("dark");
    expect(parsePreferenceJson("4")).toBe(4);
    expect(parsePreferenceJson('{"theme":"dark"}')).toEqual({ theme: "dark" });
    expect(() => parsePreferenceJson("dark")).toThrow("Preference value must be valid JSON");
  });
});
