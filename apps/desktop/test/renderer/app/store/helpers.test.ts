import { describe, expect, it } from "vitest";

import { resolveLoadedSelection } from "@/renderer/app/store/helpers";
import type { DesktopCommand, DesktopPlugin, DesktopPreference } from "@/shared/desktop-api";

describe("resolveLoadedSelection", () => {
  it("clears a command selection that conflicts with the selected provider", () => {
    expect(
      resolveLoadedSelection({
        commands: [createCommand("json.format", "dev.tooldeck.json-tools")],
        plugins: [
          createPlugin("dev.tooldeck.hello-world"),
          createPlugin("dev.tooldeck.json-tools"),
        ],
        preferences: [],
        selectedCommandId: "json.format",
        selectedPluginId: "dev.tooldeck.hello-world",
      }),
    ).toEqual({
      selectedPluginId: "dev.tooldeck.hello-world",
    });
  });

  it("keeps a command selection when it matches the selected provider", () => {
    expect(
      resolveLoadedSelection({
        commands: [createCommand("json.format", "dev.tooldeck.json-tools")],
        plugins: [createPlugin("dev.tooldeck.json-tools")],
        preferences: [],
        selectedCommandId: "json.format",
        selectedPluginId: "dev.tooldeck.json-tools",
      }),
    ).toEqual({
      selectedCommandId: "json.format",
      selectedPluginId: "dev.tooldeck.json-tools",
    });
  });

  it("falls back to the first command in entry-first navigation", () => {
    expect(
      resolveLoadedSelection({
        commands: [createCommand("json.format", "dev.tooldeck.json-tools")],
        plugins: [createPlugin("dev.tooldeck.json-tools")],
        preferences: [createNavigationModePreference("entry-first")],
        selectedCommandId: "missing.command",
        selectedPluginId: "missing.plugin",
      }),
    ).toEqual({
      selectedCommandId: "json.format",
      selectedPluginId: "dev.tooldeck.json-tools",
    });
  });
});

function createCommand(id: string, pluginId: string): DesktopCommand {
  return {
    id,
    pluginId,
    pluginEnabled: true,
    pluginRuntimeState: "inactive",
    title: id,
    searchText: [],
  };
}

function createPlugin(id: string): DesktopPlugin {
  return {
    id,
    name: id,
    version: "1.0.0",
    manifestPath: `plugins/${id}/manifest.json`,
    sourceKind: "builtin",
    enabled: true,
    runtimeState: "inactive",
    commandCount: 1,
    updatedAt: 1000,
    searchText: [],
  };
}

function createNavigationModePreference(
  value: "entry-first" | "provider-first",
): DesktopPreference {
  return {
    scope: "desktop",
    key: "navigation.mode",
    value,
    defaultValue: "provider-first",
    description: "Navigation mode",
    valueType: "enum",
    values: ["provider-first", "entry-first"],
  };
}
