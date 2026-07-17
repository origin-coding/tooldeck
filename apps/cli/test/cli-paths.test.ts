import path from "node:path";

import { expect, it, describe } from "vitest";

import {
  ensureCliInstalledPluginSource,
  parseCliPluginDirArgs,
  resolveCliRuntimePaths,
  resolveCliPluginDirOption,
} from "../src/cli";

describe("CLI runtime paths", () => {
  it("resolves default CLI runtime paths from Tooldeck paths", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "plugins"));
    expect(paths.storagePath).toContain("tooldeck.sqlite");
    expect(paths.storagePath).not.toBe(path.join(workspaceRoot, ".data", "tooldeck.sqlite"));
  });

  it("resolves relative CLI path overrides against the workspace root", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      plugins: "./fixtures/plugins",
      storage: "./.data/test.sqlite",
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "fixtures", "plugins"));
    expect(paths.storagePath).toBe(path.join(workspaceRoot, ".data", "test.sqlite"));
  });

  it("resolves bundled builtin plugins in production mode", () => {
    const appInstallDir = path.resolve("app", "cli", "dist");
    const builtinPluginsDir = path.join(appInstallDir, "plugins");
    const paths = resolveCliRuntimePaths({
      appInstallDir,
      builtinPluginsDir,
      mode: "production",
      workspaceRoot: path.resolve("workspace"),
    });

    expect(paths.pluginsRoot).toBe(builtinPluginsDir);
    expect(paths.tooldeckPaths.appInstallDir).toBe(appInstallDir);
  });

  it("preserves absolute CLI path overrides", () => {
    const workspaceRoot = path.resolve("workspace");
    const pluginsRoot = path.resolve("external", "plugins");
    const storagePath = path.resolve("external", "data", "tooldeck.sqlite");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      plugins: pluginsRoot,
      storage: storagePath,
    });

    expect(paths.pluginsRoot).toBe(pluginsRoot);
    expect(paths.storagePath).toBe(storagePath);
  });

  it("resolves additional plugin dirs as external scan sources", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      pluginDir: ["../external-a", "../external-b"],
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "plugins"));
    expect(paths.pluginSources).toEqual([
      {
        kind: "builtin",
        path: path.join(workspaceRoot, "plugins"),
      },
      {
        kind: "installed",
        path: paths.tooldeckPaths.installedPluginsDir,
      },
      {
        kind: "external",
        path: path.resolve(workspaceRoot, "../external-a"),
      },
      {
        kind: "external",
        path: path.resolve(workspaceRoot, "../external-b"),
      },
    ]);
  });

  it("inserts a derived installed source before custom external sources", () => {
    const storagePath = path.resolve("workspace", ".data", "tooldeck.sqlite");
    const builtinPath = path.resolve("workspace", "plugins");
    const externalPath = path.resolve("external", "plugins");

    expect(
      ensureCliInstalledPluginSource(
        [
          { kind: "builtin", path: builtinPath },
          { kind: "external", path: externalPath },
        ],
        storagePath,
      ),
    ).toEqual([
      { kind: "builtin", path: builtinPath },
      {
        kind: "installed",
        path: path.join(path.dirname(storagePath), "installed-plugins"),
      },
      { kind: "external", path: externalPath },
    ]);
  });

  it("parses repeated --plugin-dir arguments from raw CLI args", () => {
    const rawArgs = [
      "run",
      "hello.world",
      "--plugin-dir",
      "../external-a",
      "--plugin-dir=../external-b",
    ];

    expect(parseCliPluginDirArgs(rawArgs)).toEqual(["../external-a", "../external-b"]);
    expect(
      resolveCliPluginDirOption({
        rawArgs,
        value: "../last-only",
      }),
    ).toEqual(["../external-a", "../external-b"]);
  });
});
