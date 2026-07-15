import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import {
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
} from "@tooldeck/storage";
import { afterEach, describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "./tooldeck-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("TooldeckDesktopService", () => {
  it("lists commands, runs json.format, and records desktop history", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      const commands = service.listCommands();
      const plugins = service.listPlugins();
      const localizedCommands = service.listCommands({ locale: "zh-CN" });
      const localizedPlugins = service.listPlugins({ locale: "zh-CN" });

      expect(commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
            pluginEnabled: true,
            pluginRuntimeState: "inactive",
            title: "Format JSON",
            "x-ui": {
              layout: "split",
            },
          }),
        ]),
      );
      expect(localizedCommands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            title: "格式化 JSON",
            description: "使用可配置缩进格式化 JSON 文本。",
            inputSchema: expect.objectContaining({
              properties: expect.objectContaining({
                text: expect.objectContaining({
                  title: "JSON 文本",
                }),
                indent: expect.objectContaining({
                  title: "缩进大小",
                }),
              }),
            }),
          }),
        ]),
      );
      expect(plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            enabled: true,
            runtimeState: "inactive",
            commandCount: expect.any(Number),
          }),
        ]),
      );
      expect(localizedPlugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            name: "JSON 工具",
            description: "用于格式化 JSON 的工具。",
          }),
        ]),
      );
      await expect(service.rescanPlugins({ locale: "zh-CN" })).resolves.toMatchObject({
        commands: expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            title: "格式化 JSON",
          }),
        ]),
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            name: "JSON 工具",
          }),
        ]),
      });

      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "code",
            text: '{\n  "a": 1\n}',
            language: "json",
          },
        ],
      });
      expect(service.listPlugins()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            enabled: true,
            runtimeState: "active",
          }),
        ]),
      );

      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "json.format",
          pluginId: "dev.tooldeck.json-tools",
          source: "desktop",
          status: "success",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
          output: {
            status: "success",
            blocks: [
              {
                type: "code",
                text: '{\n  "a": 1\n}',
                language: "json",
              },
            ],
          },
          durationMs: expect.any(Number),
          createdAt: expect.any(Number),
        }),
      ]);
      expect(service.listCommandRuns({ commandId: "json.format" })).toHaveLength(1);
      expect(service.listCommandRuns({ commandId: "json.validate" })).toHaveLength(0);
    } finally {
      await service.dispose();
    }
  });

  it("persists plugin enabled state and blocks disabled desktop commands", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      await expect(
        service.setPluginEnabled({
          pluginId: "dev.tooldeck.json-tools",
          enabled: false,
        }),
      ).resolves.toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: false,
        runtimeState: "inactive",
      });

      expect(service.listCommands()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginEnabled: false,
          }),
        ]),
      );
      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).rejects.toThrow("Plugin is disabled for command json.format: dev.tooldeck.json-tools");
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "json.format",
          pluginId: "dev.tooldeck.json-tools",
          source: "desktop",
          status: "error",
          error: expect.objectContaining({
            message: "Plugin is disabled for command json.format: dev.tooldeck.json-tools",
          }),
        }),
      ]);

      await expect(
        service.setPluginEnabled({
          pluginId: "dev.tooldeck.json-tools",
          enabled: true,
        }),
      ).resolves.toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: true,
      });
      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).resolves.toMatchObject({
        status: "success",
      });
    } finally {
      await service.dispose();
    }
  });

  it("lists and runs commands from external plugin dirs", async () => {
    const externalRoot = path.join(createTempDir(), "external-echo");
    const service = new TooldeckDesktopService({
      pluginDirs: [externalRoot],
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await createEchoPlugin({
      commandId: "external.echo",
      pluginId: "dev.tooldeck.external-echo",
      pluginRoot: externalRoot,
      responseText: "external ok",
    });
    await service.start();

    try {
      expect(service.listCommands()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
          }),
          expect.objectContaining({
            id: "external.echo",
            pluginId: "dev.tooldeck.external-echo",
          }),
        ]),
      );

      await expect(
        service.runCommand({
          commandId: "external.echo",
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "external ok",
          },
        ],
      });
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "external.echo",
          pluginId: "dev.tooldeck.external-echo",
          source: "desktop",
          status: "success",
        }),
      ]);
    } finally {
      await service.dispose();
    }
  });

  it("adds the managed installed source to custom desktop plugin sources", async () => {
    const rootDir = createTempDir();
    const externalRoot = path.join(rootDir, "external-plugins");
    const installedPluginsDir = path.join(rootDir, "managed-plugins");
    const storagePath = path.join(rootDir, "tooldeck.sqlite");
    const pluginsRoot = path.resolve("../..", "plugins");

    mkdirSync(externalRoot, { recursive: true });

    const service = new TooldeckDesktopService({
      installedPluginsDir,
      pluginSources: [
        { kind: "builtin", path: pluginsRoot },
        { kind: "external", path: externalRoot },
      ],
      storagePath,
    });

    await service.start();

    try {
      expect(service.listPlugins()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
          }),
        ]),
      );
    } finally {
      await service.dispose();
    }
  });

  it("installs, runs, uninstalls, and purges a managed plugin", async () => {
    const rootDir = createTempDir();
    const pluginsRoot = path.join(rootDir, "builtin-plugins");
    const installedPluginsDir = path.join(rootDir, "installed-plugins");
    const storagePath = path.join(rootDir, "tooldeck.sqlite");
    const activationMarkerPath = path.join(rootDir, "installed-plugin-activated.txt");
    const packagePath = await createInstallablePluginPackage({
      rootDir,
      activationMarkerPath,
      commandId: "installed.echo",
      pluginId: "dev.example.desktop-installed",
    });
    const service = new TooldeckDesktopService({
      installedPluginsDir,
      pluginsRoot,
      storagePath,
    });

    mkdirSync(pluginsRoot, { recursive: true });
    await service.start();

    try {
      const installed = await service.installPluginPackage({
        packagePath,
        locale: "en-US",
      });

      expect(installed).toMatchObject({
        status: "installed",
        installedPluginId: "dev.example.desktop-installed",
        packageName: path.basename(packagePath),
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dev.example.desktop-installed",
            sourceKind: "installed",
            runtimeState: "inactive",
          }),
        ]),
        commands: expect.arrayContaining([
          expect.objectContaining({
            id: "installed.echo",
            pluginId: "dev.example.desktop-installed",
          }),
        ]),
      });
      expect(existsSync(activationMarkerPath)).toBe(false);

      await expect(
        service.runCommand({
          commandId: "installed.echo",
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [{ type: "text", text: "installed ok" }],
      });
      expect(existsSync(activationMarkerPath)).toBe(true);
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "installed.echo",
          pluginId: "dev.example.desktop-installed",
          source: "desktop",
          status: "success",
        }),
      ]);

      const dataDatabase = openTooldeckDatabase({ path: storagePath });

      try {
        new PluginKvRepository(dataDatabase.db).set({
          pluginId: "dev.example.desktop-installed",
          key: "retained",
          value: true,
        });
      } finally {
        dataDatabase.close();
      }

      await expect(
        service.uninstallPlugin({
          pluginId: "dev.example.desktop-installed",
          locale: "en-US",
        }),
      ).resolves.toMatchObject({
        cleanupPending: false,
        pluginId: "dev.example.desktop-installed",
        plugins: expect.not.arrayContaining([
          expect.objectContaining({ id: "dev.example.desktop-installed" }),
        ]),
        residues: [
          {
            pluginId: "dev.example.desktop-installed",
            statePresent: true,
            kvEntries: 1,
          },
        ],
      });

      expect(service.purgePluginData({ pluginId: "dev.example.desktop-installed" })).toMatchObject({
        pluginId: "dev.example.desktop-installed",
        stateRemoved: true,
        kvEntriesRemoved: 1,
        residues: [],
      });
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "installed.echo",
          pluginId: "dev.example.desktop-installed",
        }),
      ]);

      const verifiedDatabase = openTooldeckDatabase({ path: storagePath });

      try {
        expect(
          new PluginStateRepository(verifiedDatabase.db).getById("dev.example.desktop-installed"),
        ).toBeUndefined();
        expect(
          new PluginKvRepository(verifiedDatabase.db).listByPlugin("dev.example.desktop-installed"),
        ).toEqual([]);
      } finally {
        verifiedDatabase.close();
      }
    } finally {
      await service.dispose();
    }
  });

  it("removes plugin registry rows missing from the scanned plugin directory", async () => {
    const storagePath = createDatabasePath();
    const pluginsRoot = path.join(createTempDir(), "plugins");

    mkdirSync(pluginsRoot, { recursive: true });

    const database = openTooldeckDatabase({ path: storagePath });

    try {
      new PluginRepository(database.db).upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.deleted-plugin", "Deleted Plugin", "1.0.0"),
        manifestPath: path.join(pluginsRoot, "deleted-plugin", "manifest.json"),
        now: 1000,
      });
    } finally {
      database.close();
    }

    const service = new TooldeckDesktopService({
      pluginsRoot,
      storagePath,
    });

    await service.start();

    try {
      expect(service.listPlugins()).toEqual([]);
      expect(service.listCommands()).toEqual([]);
    } finally {
      await service.dispose();
    }
  });

  it("localizes command result properties", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      await expect(
        service.runCommand({
          commandId: "regex.test",
          locale: "zh-CN",
          input: {
            pattern: "[0-9]+",
            text: "abc123",
            flags: [],
            mode: "contains",
          },
        }),
      ).resolves.toMatchObject({
        status: "success",
        blocks: [
          {
            type: "properties",
            items: expect.arrayContaining([
              expect.objectContaining({
                label: "是否匹配",
                value: true,
              }),
            ]),
          },
          {
            type: "json",
          },
        ],
      });
    } finally {
      await service.dispose();
    }
  });

  it("stores desktop-visible preferences", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      expect(service.listPreferences()).toEqual([
        expect.objectContaining({
          scope: "shared",
          key: "locale",
          value: "system",
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
      expect(
        service.getPreference({
          scope: "shared",
          key: "locale",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "system",
      });

      expect(
        service.setPreference({
          scope: "shared",
          key: "locale",
          value: "zh-CN",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
        updatedAt: expect.any(Number),
      });
      expect(service.listPreferences()).toEqual([
        expect.objectContaining({
          scope: "shared",
          key: "locale",
          value: "zh-CN",
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
      expect(
        service.getPreference({
          scope: "shared",
          key: "locale",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
      });
      expect(
        service.setPreference({
          scope: "desktop",
          key: "navigation.mode",
          value: "entry-first",
        }),
      ).toMatchObject({
        scope: "desktop",
        key: "navigation.mode",
        value: "entry-first",
      });
      expect(
        service.setPreference({
          scope: "desktop",
          key: "sidebar.collapsed",
          value: true,
        }),
      ).toMatchObject({
        scope: "desktop",
        key: "sidebar.collapsed",
        value: true,
      });
      expect(() =>
        service.setPreference({
          scope: "cli",
          key: "output.format",
          value: "json",
        }),
      ).toThrow("Desktop cannot manage preference: cli.output.format");
      expect(() =>
        service.getPreference({
          scope: "cli",
          key: "output.format",
        }),
      ).toThrow("Desktop cannot manage preference: cli.output.format");
    } finally {
      await service.dispose();
    }
  });
});

function createDatabasePath(): string {
  return path.join(createTempDir(), "tooldeck.sqlite");
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-desktop-"));

  tempDirs.push(dir);

  return dir;
}

function createPluginManifest(id: string, name: string, version: string) {
  return {
    schemaVersion: "1.0" as const,
    id,
    name,
    version,
    runtime: {
      kind: "node" as const,
      entry: "./dist/index.js",
    },
  };
}

async function createEchoPlugin(options: {
  commandId: string;
  pluginId: string;
  pluginRoot: string;
  responseText: string;
}): Promise<void> {
  mkdirSync(options.pluginRoot, { recursive: true });
  await writeFile(
    path.join(options.pluginRoot, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "External Echo",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./index.mjs",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "External Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(options.pluginRoot, "index.mjs"),
    `
      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: ${JSON.stringify(options.responseText)} }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
}

async function createInstallablePluginPackage(options: {
  activationMarkerPath: string;
  commandId: string;
  pluginId: string;
  rootDir: string;
}): Promise<string> {
  const projectDir = path.join(options.rootDir, "installable-plugin-project");
  const runtimeDir = path.join(projectDir, "dist");
  const packagePath = path.join(options.rootDir, `${options.pluginId}-1.0.0.tdplugin`);

  mkdirSync(runtimeDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "Desktop Installed Plugin",
      version: "1.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "Installed Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(runtimeDir, "index.js"),
    `
      import { writeFile } from "node:fs/promises";

      await writeFile(${JSON.stringify(options.activationMarkerPath)}, "activated", "utf8");

      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: "installed ok" }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
  await packTooldeckPlugin({
    projectDir,
    outputPath: packagePath,
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
  });

  return packagePath;
}
