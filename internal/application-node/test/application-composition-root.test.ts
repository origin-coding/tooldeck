import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { composeTooldeckApplication } from "@/application/composition-root";
import { normalizeApplicationConfiguration } from "@/application/configuration";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import { ApplicationCommands } from "@/commands/application-commands";
import { ApplicationHistory } from "@/history/application-history";
import type { TooldeckPaths } from "@/paths";
import { ApplicationPlugins } from "@/plugins/application-plugins";
import { ApplicationPreferences } from "@/preferences/application-preferences";

describe("application composition root", () => {
  it("normalizes configuration before constructing application services", () => {
    const paths = createPaths("configuration");
    const preprocessInput = vi.fn(({ input }) => input);
    const configuration = normalizeApplicationConfiguration({
      paths,
      commandInputCoercion: "cli",
      pluginSources: [
        { kind: "external", path: paths.userPluginsDir },
        { kind: "builtin", path: paths.builtinPluginsDir },
      ],
      adapters: {
        commands: { preprocessInput },
      },
    });

    expect(configuration).toEqual({
      paths,
      commandInputCoercion: "cli",
      pluginSources: [
        { kind: "builtin", path: paths.builtinPluginsDir },
        { kind: "installed", path: paths.installedPluginsDir },
        { kind: "external", path: paths.userPluginsDir },
      ],
      preprocessCommandInput: preprocessInput,
    });
  });

  it("keeps invalid path and installed-source combinations at the configuration boundary", () => {
    const paths = createPaths("invalid-configuration");

    expect(() =>
      normalizeApplicationConfiguration({ paths, pathOptions: { appName: "tooldeck-test" } }),
    ).toThrow("Application paths and pathOptions cannot both be provided.");
    expect(() =>
      normalizeApplicationConfiguration({
        paths,
        pluginSources: [
          { kind: "installed", path: paths.installedPluginsDir },
          { kind: "installed", path: paths.installedPluginsDir },
        ],
      }),
    ).toThrow("Application plugin sources may contain at most one installed source.");
    expect(() =>
      normalizeApplicationConfiguration({
        paths,
        pluginSources: [{ kind: "installed", path: path.join(paths.userDataDir, "other") }],
      }),
    ).toThrow("Installed plugin source does not match the application installed plugins path.");
  });

  it("constructs lifecycle coordination and narrow domain facades", async () => {
    const paths = createPaths("composition");
    const composition = composeTooldeckApplication({ paths });

    expect(composition.configuration.paths).toBe(paths);
    expect(composition.lifecycle).toBeInstanceOf(ApplicationLifecycleCoordinator);
    expect(composition.facades.commands).toBeInstanceOf(ApplicationCommands);
    expect(composition.facades.plugins).toBeInstanceOf(ApplicationPlugins);
    expect(composition.facades.preferences).toBeInstanceOf(ApplicationPreferences);
    expect(composition.facades.history).toBeInstanceOf(ApplicationHistory);

    await expect(composition.lifecycle.dispose()).resolves.toBeUndefined();
  });
});

function createPaths(name: string): TooldeckPaths {
  const rootDir = path.resolve("test", ".fixtures", name);
  const dataDir = path.join(rootDir, "data");

  return {
    appInstallDir: rootDir,
    builtinPluginsDir: path.join(rootDir, "builtin-plugins"),
    userConfigDir: path.join(rootDir, "config"),
    userDataDir: dataDir,
    databasePath: path.join(dataDir, "tooldeck.sqlite"),
    installedPluginsDir: path.join(dataDir, "installed-plugins"),
    userPluginsDir: path.join(dataDir, "plugins"),
    pluginDataDir: path.join(dataDir, "plugin-data"),
    cacheDir: path.join(rootDir, "cache"),
    logsDir: path.join(rootDir, "logs"),
    tempDir: path.join(rootDir, "temp"),
  };
}
