import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { runCommand } from "citty";
import { consola } from "consola";
import { expect, it, vi, describe } from "vitest";

import {
  createCliCommand,
  listCliCommands,
  listCliPlugins,
  runCliCommandWithStorage,
  setCliPluginEnabled,
} from "../src/cli";
import {
  createDatabasePath,
  createEchoPlugin,
  createTempDir,
  readCommandRuns,
  readPlugins,
  readPluginInstall,
  readPluginKvValue,
  writePluginKvValue,
  readPluginState,
} from "./cli-test-fixtures";

describe("CLI plugin management", () => {
  it("lists scanned plugins through the SQLite plugin registry", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    const plugins = await listCliPlugins({
      pluginsRoot,
      storagePath,
    });

    expect(plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dev.tooldeck.hello-world",
          enabled: true,
          name: "Hello World",
        }),
        expect.objectContaining({
          id: "dev.tooldeck.json-tools",
          enabled: true,
          name: "JSON Tools",
        }),
      ]),
    );
    expect(readPlugins(storagePath).map((plugin) => plugin.id)).toEqual(
      expect.arrayContaining(["dev.tooldeck.hello-world", "dev.tooldeck.json-tools"]),
    );
  });

  it("enables and disables plugins in the SQLite plugin registry", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await expect(
      setCliPluginEnabled({
        pluginId: "dev.tooldeck.hello-world",
        enabled: false,
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      id: "dev.tooldeck.hello-world",
      enabled: false,
    });
    await expect(
      setCliPluginEnabled({
        pluginId: "dev.tooldeck.hello-world",
        enabled: true,
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      id: "dev.tooldeck.hello-world",
      enabled: true,
    });
  });

  it("completes the local package install, list, run, and uninstall workflow", async () => {
    const rootDir = createTempDir();
    const builtinPluginsDir = path.join(rootDir, "builtin-plugins");
    const installedPluginsDir = path.join(rootDir, "installed-plugins");
    const projectDir = path.join(rootDir, "echo-project");
    const packagePath = path.join(rootDir, "dev.example.cli-echo-0.1.0.tdplugin");
    const storagePath = path.join(rootDir, "tooldeck.sqlite");
    const activationMarkerPath = path.join(rootDir, "activated.txt");
    const pluginId = "dev.example.cli-echo";
    const commandId = "cli-echo.run";

    await mkdir(builtinPluginsDir, { recursive: true });
    await createEchoPlugin({
      activationMarkerPath,
      commandId,
      pluginId,
      pluginRoot: projectDir,
      responseText: "installed ok",
      version: "0.1.0",
    });
    await packTooldeckPlugin({
      projectDir,
      outputPath: packagePath,
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
    });

    const cli = createCliCommand({
      builtinPluginsDir,
      installedPluginsDir,
      workspaceRoot: rootDir,
    });
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      await runCommand(cli, {
        rawArgs: ["plugin", "install", packagePath, "--storage", storagePath],
      });

      expect(existsSync(activationMarkerPath)).toBe(false);
      expect(readPluginInstall(storagePath, pluginId)).toMatchObject({
        pluginId,
        version: "0.1.0",
        installDir: path.join(installedPluginsDir, pluginId),
      });
      expect(String(log.mock.calls.at(-1)?.[0])).toContain(`Installed ${pluginId}.`);

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["plugin", "list", "--storage", storagePath],
      });

      expect(existsSync(activationMarkerPath)).toBe(false);
      expect(String(log.mock.calls.at(-1)?.[0])).toContain("installed");
      expect(String(log.mock.calls.at(-1)?.[0])).toContain(pluginId);

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["plugin", "disable", pluginId, "--storage", storagePath],
      });

      expect(readPluginState(storagePath, pluginId)).toMatchObject({ enabled: false });
      expect(existsSync(activationMarkerPath)).toBe(false);

      await expect(
        runCommand(cli, {
          rawArgs: ["run", commandId, "--storage", storagePath],
        }),
      ).rejects.toThrow(`Plugin is disabled for command ${commandId}: ${pluginId}`);
      expect(existsSync(activationMarkerPath)).toBe(false);
      expect(readCommandRuns(storagePath)).toEqual([
        expect.objectContaining({
          commandId,
          pluginId,
          source: "cli",
          status: "error",
        }),
      ]);

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["plugin", "enable", pluginId, "--storage", storagePath],
      });

      expect(readPluginState(storagePath, pluginId)).toMatchObject({ enabled: true });

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["run", commandId, "--storage", storagePath],
      });

      expect(existsSync(activationMarkerPath)).toBe(true);
      expect(String(log.mock.calls.at(-1)?.[0])).toBe("installed ok");
      expect(readCommandRuns(storagePath)).toEqual([
        expect.objectContaining({
          commandId,
          pluginId,
          source: "cli",
          status: "success",
        }),
        expect.objectContaining({
          commandId,
          pluginId,
          source: "cli",
          status: "error",
        }),
      ]);
      writePluginKvValue(storagePath, pluginId, "retained", true);

      await expect(
        runCommand(cli, {
          rawArgs: ["plugin", "purge", pluginId, "--storage", storagePath],
        }),
      ).rejects.toThrow(`tooldeck plugin uninstall ${pluginId}`);
      expect(readPluginKvValue(storagePath, pluginId, "retained")).toBe(true);

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["plugin", "uninstall", pluginId, "--storage", storagePath],
      });

      expect(readPluginInstall(storagePath, pluginId)).toBeUndefined();
      expect(existsSync(path.join(installedPluginsDir, pluginId))).toBe(false);
      expect(String(log.mock.calls.at(-1)?.[0])).toContain(`Uninstalled ${pluginId}.`);

      log.mockClear();
      await runCommand(cli, {
        rawArgs: ["plugin", "purge", pluginId, "--storage", storagePath],
      });

      expect(readPluginState(storagePath, pluginId)).toBeUndefined();
      expect(readPluginKvValue(storagePath, pluginId, "retained")).toBeUndefined();
      expect(readCommandRuns(storagePath)).toEqual([
        expect.objectContaining({
          commandId,
          pluginId,
          status: "success",
        }),
        expect.objectContaining({
          commandId,
          pluginId,
          status: "error",
        }),
      ]);
      expect(String(log.mock.calls.at(-1)?.[0])).toContain(`Purged local data for ${pluginId}.`);
      expect(String(log.mock.calls.at(-1)?.[0])).toContain("Command history was preserved.");
      await expect(
        listCliCommands({
          pluginSources: [
            { kind: "builtin", path: builtinPluginsDir },
            { kind: "installed", path: installedPluginsDir },
          ],
        }),
      ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: commandId })]));
    } finally {
      log.mockRestore();
    }
  });

  it("does not activate disabled plugins when running commands", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "disabled-test");
    const activationMarkerPath = path.join(pluginRoot, "activated.txt");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.disabled-test",
        name: "Disabled Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "disabled.run",
              title: "Disabled Run",
            },
          ],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        import { writeFile } from "node:fs/promises";

        export default {
          async activate(ctx) {
            await writeFile(${JSON.stringify(activationMarkerPath)}, "activated", "utf8");
            ctx.subscriptions.push(
              ctx.commands.register("disabled.run", () => ({
                status: "success",
                blocks: [{ type: "text", text: "should not run" }],
              })),
            );
          },
        };
      `,
      "utf8",
    );

    await setCliPluginEnabled({
      pluginId: "dev.tooldeck.disabled-test",
      enabled: false,
      pluginsRoot,
      storagePath,
    });

    await expect(
      runCliCommandWithStorage({
        commandId: "disabled.run",
        pluginsRoot,
        storagePath,
      }),
    ).rejects.toThrow("Plugin is disabled for command disabled.run: dev.tooldeck.disabled-test");
    expect(existsSync(activationMarkerPath)).toBe(false);

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "disabled.run",
      pluginId: "dev.tooldeck.disabled-test",
      source: "cli",
      status: "error",
    });
  });
});
