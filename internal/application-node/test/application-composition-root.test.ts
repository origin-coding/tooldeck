import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { composeTooldeckApplication } from "@/application/composition";
import { normalizeApplicationConfiguration } from "@/application/configuration";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle";
import type { TooldeckPaths } from "@/paths";

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
    expect(composition.facades.commands).toMatchObject({
      list: expect.any(Function),
      run: expect.any(Function),
    });
    expect(composition.facades.plugins).toMatchObject({
      list: expect.any(Function),
      installPackage: expect.any(Function),
      uninstall: expect.any(Function),
    });
    expect(composition.facades.preferences).toMatchObject({
      list: expect.any(Function),
      get: expect.any(Function),
      set: expect.any(Function),
      delete: expect.any(Function),
    });
    expect(composition.facades.history).toMatchObject({
      listCommandRuns: expect.any(Function),
    });

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
