import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { afterEach, describe, expect, it } from "vitest";

import {
  ApplicationError,
  createTooldeckApplication,
  defineTooldeckApplicationAdapters,
  isApplicationError,
  type TooldeckApplication,
  type TooldeckPaths,
  withTooldeckApplication,
} from "@/index";

const applications: TooldeckApplication[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const application of applications.splice(0)) {
    await application.dispose();
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Tooldeck application facade", () => {
  it("groups domains, applies a downstream preprocessor, and records command history", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir);
    const preprocessCalls: string[] = [];
    const application = createTooldeckApplication({
      paths,
      adapters: defineTooldeckApplicationAdapters({
        commands: {
          preprocessInput({ commandId, source, input }) {
            preprocessCalls.push(`${source}:${commandId}`);
            return {
              ...input,
              text: `${String(input.text)}-processed`,
            };
          },
        },
      }),
    });

    applications.push(application);

    await expect(application.commands.list()).rejects.toSatisfy((error: unknown) =>
      isApplicationError(error, "ERR_APPLICATION_NOT_STARTED"),
    );

    await application.start();
    await application.start();

    await expect(application.commands.list()).resolves.toMatchObject([
      {
        id: "fixture.echo",
        pluginId: "dev.tooldeck.fixture",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
      },
    ]);
    await expect(application.plugins.list()).resolves.toMatchObject([
      {
        id: "dev.tooldeck.fixture",
        name: "Fixture",
        manifest: {
          id: "dev.tooldeck.fixture",
          version: "0.0.0",
        },
        sourceKind: "builtin",
        enabled: true,
        commandCount: 1,
      },
    ]);

    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "hello" },
        source: "test-surface",
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "hello-processed" }],
    });
    expect(preprocessCalls).toEqual(["test-surface:fixture.echo"]);

    await expect(application.history.listCommandRuns()).resolves.toMatchObject([
      {
        commandId: "fixture.echo",
        pluginId: "dev.tooldeck.fixture",
        source: "test-surface",
        status: "success",
        input: { text: "hello-processed" },
      },
    ]);

    await expect(
      application.preferences.set({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
      }),
    ).resolves.toMatchObject({
      scope: "shared",
      key: "locale",
      value: "zh-CN",
    });
    await expect(application.preferences.list({ scopes: ["shared"] })).resolves.toHaveLength(1);
    await application.preferences.delete({
      scope: "shared",
      key: "locale",
    });
    await expect(
      application.preferences.get({
        scope: "shared",
        key: "locale",
      }),
    ).resolves.toMatchObject({
      value: "system",
      defaultValue: "system",
    });

    await application.plugins.setEnabled("dev.tooldeck.fixture", false);
    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "disabled" },
      }),
    ).rejects.toSatisfy((error: unknown) => isApplicationError(error, "ERR_PLUGIN_DISABLED"));

    await application.dispose();
    await application.dispose();
    await expect(application.plugins.list()).rejects.toSatisfy((error: unknown) =>
      isApplicationError(error, "ERR_APPLICATION_DISPOSED"),
    );
  });

  it("scopes startup and cleanup with withTooldeckApplication", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir);

    const commandIds = await withTooldeckApplication({ paths }, async (application) =>
      (await application.commands.list()).map((command) => command.id),
    );

    expect(commandIds).toEqual(["fixture.echo"]);
  });

  it("returns install metadata needed by downstream application surfaces", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    const projectDir = path.join(rootDir, "packaged-plugin");
    const packagePath = path.join(rootDir, "dev.example.packaged-0.1.0.tdplugin");
    const pluginId = "dev.example.packaged";

    await mkdir(paths.builtinPluginsDir, { recursive: true });
    await writePackagedPlugin(projectDir, pluginId);
    await packTooldeckPlugin({
      projectDir,
      outputPath: packagePath,
      createdAt: new Date("2026-07-31T00:00:00.000Z"),
    });

    const application = createTooldeckApplication({ paths });
    applications.push(application);
    await application.start();

    const installed = await application.plugins.installPackage(packagePath);

    expect(installed).toMatchObject({
      status: "installed",
      installedPluginId: pluginId,
      packageName: path.basename(packagePath),
      install: {
        pluginId,
        version: "0.1.0",
        installDir: path.join(paths.installedPluginsDir, pluginId),
        manifestPath: path.join(paths.installedPluginsDir, pluginId, "manifest.json"),
        packageDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        packageSizeBytes: expect.any(Number),
      },
      plugin: {
        id: pluginId,
        name: "Packaged Fixture",
        version: "0.1.0",
        sourceKind: "installed",
        enabled: true,
      },
    });
    expect(existsSync(installed.install.installDir)).toBe(true);

    await expect(application.plugins.uninstall(pluginId)).resolves.toMatchObject({
      pluginId,
      install: installed.install,
    });
    expect(existsSync(installed.install.installDir)).toBe(false);
  });

  it("preserves the primary application error when scoped cleanup also fails", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir, { disposeFails: true });

    await expect(
      withTooldeckApplication({ paths }, async (application) => {
        await application.commands.run({
          commandId: "fixture.echo",
          input: { text: "activate" },
        });

        throw new ApplicationError({
          source: "application",
          code: "ERR_INVALID_ARGUMENT",
          message: "Primary operation failed.",
          details: {
            operation: "test",
          },
        });
      }),
    ).rejects.toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Primary operation failed.",
      details: {
        operation: "test",
        cleanupFailure: {
          tag: "ApplicationError",
          source: "runtime",
          code: "ERR_PLUGIN_LOAD_FAILED",
        },
      },
    });
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-application-"));
  tempDirs.push(dir);
  return dir;
}

function createPaths(rootDir: string): TooldeckPaths {
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

async function writeFixturePlugin(
  builtinPluginsDir: string,
  options: { disposeFails?: boolean } = {},
): Promise<void> {
  const pluginDir = path.join(builtinPluginsDir, "fixture");

  await mkdir(pluginDir, { recursive: true });
  await writeFile(
    path.join(pluginDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: "dev.tooldeck.fixture",
      name: "Fixture",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./index.mjs",
      },
      contributes: {
        commands: [
          {
            id: "fixture.echo",
            title: "Echo",
            inputSchema: {
              type: "object",
              required: ["text"],
              additionalProperties: false,
              properties: {
                text: { type: "string" },
              },
            },
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(pluginDir, "index.mjs"),
    [
      "export default {",
      "  activate(context) {",
      ...(options.disposeFails
        ? [
            "    context.subscriptions.push({",
            "      dispose() {",
            '        throw new Error("Fixture disposal failed.");',
            "      },",
            "    });",
          ]
        : []),
      "    context.subscriptions.push(",
      '      context.commands.register("fixture.echo", (input) => ({',
      '        status: "success",',
      '        blocks: [{ type: "text", text: String(input.text) }],',
      "      })),",
      "    );",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function writePackagedPlugin(projectDir: string, pluginId: string): Promise<void> {
  const runtimeDir = path.join(projectDir, "dist");

  await mkdir(runtimeDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: pluginId,
      name: "Packaged Fixture",
      version: "0.1.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: "packaged.run",
            title: "Packaged Run",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(path.join(runtimeDir, "index.js"), "export default { activate() {} };\n", "utf8");
}
