import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  ApplicationError,
  createTooldeckApplication,
  defineTooldeckApplicationAdapters,
  isApplicationError,
  type TooldeckApplication,
  type TooldeckPaths,
  withTooldeckApplication,
} from "@/index";
import { CommandRunRepository } from "@/storage";

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
  it("keeps the public lifecycle boundary Promise-based", () => {
    expectTypeOf<TooldeckApplication["start"]>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<TooldeckApplication["dispose"]>().returns.toEqualTypeOf<Promise<void>>();
  });

  it("owns single-flight start and dispose promises without changing the public lifecycle API", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir);
    const application = createTooldeckApplication({ paths });

    applications.push(application);

    const firstStart = application.start();
    const secondStart = application.start();

    expect(secondStart).toBe(firstStart);
    await firstStart;

    const firstDispose = application.dispose();
    const secondDispose = application.dispose();

    expect(secondDispose).toBe(firstDispose);
    await firstDispose;
    await expect(application.start()).rejects.toSatisfy((error: unknown) =>
      isApplicationError(error, "ERR_APPLICATION_DISPOSED"),
    );
  });

  it("disposes an unstarted application once and preserves disposed lifecycle errors", async () => {
    const rootDir = createTempDir();
    const application = createTooldeckApplication({ paths: createPaths(rootDir) });

    applications.push(application);

    await expect(application.commands.list()).rejects.toMatchObject({
      source: "application",
      code: "ERR_APPLICATION_NOT_STARTED",
      message: "Tooldeck application runtime is unavailable before start.",
    });

    const firstDispose = application.dispose();
    const secondDispose = application.dispose();

    expect(secondDispose).toBe(firstDispose);
    await expect(firstDispose).resolves.toBeUndefined();
    await expect(application.start()).rejects.toMatchObject({
      source: "application",
      code: "ERR_APPLICATION_DISPOSED",
      message: "Tooldeck application is disposing or has already been disposed.",
    });
    await expect(application.commands.list()).rejects.toMatchObject({
      source: "application",
      code: "ERR_APPLICATION_DISPOSED",
      message: "Tooldeck application runtime is unavailable after disposal.",
    });
  });

  it("allows a failed start to be retried after partial resources are released", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    const externalPluginsDir = path.join(rootDir, "external-plugins");
    const close = vi.spyOn(DatabaseSync.prototype, "close");
    const application = createTooldeckApplication({
      paths,
      pluginSources: [{ kind: "external", path: externalPluginsDir }],
    });

    applications.push(application);

    try {
      const firstStart = application.start();
      const concurrentStart = application.start();

      expect(concurrentStart).toBe(firstStart);
      await expect(firstStart).rejects.toMatchObject({
        source: "application",
        code: "ERR_UNKNOWN",
        message: "Application operation failed unexpectedly.",
      });
      expect(close).toHaveBeenCalledTimes(1);

      await mkdir(externalPluginsDir, { recursive: true });

      const retryStart = application.start();
      expect(retryStart).not.toBe(firstStart);
      expect(application.start()).toBe(retryStart);
      await expect(retryStart).resolves.toBeUndefined();
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });

  it("waits for an in-flight failed start before completing single-flight disposal", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    const application = createTooldeckApplication({
      paths,
      pluginSources: [{ kind: "external", path: path.join(rootDir, "missing-plugins") }],
    });

    applications.push(application);

    const start = application.start();
    const firstDispose = application.dispose();
    const secondDispose = application.dispose();

    expect(secondDispose).toBe(firstDispose);
    await expect(start).rejects.toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation failed unexpectedly.",
    });
    await expect(firstDispose).resolves.toBeUndefined();
    await expect(application.start()).rejects.toMatchObject({
      source: "application",
      code: "ERR_APPLICATION_DISPOSED",
      message: "Tooldeck application is disposing or has already been disposed.",
    });
  });

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
    const preprocessCallsBeforeDisabledRun = [...preprocessCalls];
    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "disabled" },
      }),
    ).rejects.toSatisfy((error: unknown) => isApplicationError(error, "ERR_PLUGIN_DISABLED"));
    expect(preprocessCalls).toEqual(preprocessCallsBeforeDisabledRun);

    await application.dispose();
    await application.dispose();
    await expect(application.plugins.list()).rejects.toSatisfy((error: unknown) =>
      isApplicationError(error, "ERR_APPLICATION_DISPOSED"),
    );
  });

  it("preserves catalog state and history across runtime rebuilds and catalog removal", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir);
    const application = createTooldeckApplication({ paths });

    applications.push(application);
    await application.start();

    await application.commands.run({
      commandId: "fixture.echo",
      input: { text: "before-rebuild" },
      source: "baseline-before-rebuild",
    });
    await expect(application.plugins.list()).resolves.toMatchObject([
      {
        id: "dev.tooldeck.fixture",
        enabled: true,
        runtimeState: "active",
      },
    ]);

    await expect(application.plugins.rescan()).resolves.toMatchObject({
      commands: [
        {
          id: "fixture.echo",
          pluginEnabled: true,
          pluginRuntimeState: "inactive",
        },
      ],
      plugins: [
        {
          id: "dev.tooldeck.fixture",
          enabled: true,
          runtimeState: "inactive",
        },
      ],
    });

    await application.plugins.setEnabled("dev.tooldeck.fixture", false);
    await expect(application.plugins.rescan()).resolves.toMatchObject({
      commands: [
        {
          id: "fixture.echo",
          pluginEnabled: false,
          pluginRuntimeState: "inactive",
        },
      ],
      plugins: [
        {
          id: "dev.tooldeck.fixture",
          enabled: false,
          runtimeState: "inactive",
        },
      ],
    });
    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "disabled" },
        source: "baseline-disabled-gate",
      }),
    ).rejects.toSatisfy((error: unknown) => isApplicationError(error, "ERR_PLUGIN_DISABLED"));

    await application.plugins.setEnabled("dev.tooldeck.fixture", true);
    await application.commands.run({
      commandId: "fixture.echo",
      input: { text: "after-rebuild" },
      source: "baseline-after-rebuild",
    });

    await rm(path.join(paths.builtinPluginsDir, "fixture"), { recursive: true });
    await expect(application.plugins.rescan()).resolves.toEqual({ commands: [], plugins: [] });
    await expect(application.history.listCommandRuns()).resolves.toMatchObject([
      {
        commandId: "fixture.echo",
        pluginId: "dev.tooldeck.fixture",
        source: "baseline-after-rebuild",
        status: "success",
      },
      {
        commandId: "fixture.echo",
        pluginId: "dev.tooldeck.fixture",
        source: "baseline-disabled-gate",
        status: "error",
        error: {
          source: "application",
          code: "ERR_PLUGIN_DISABLED",
        },
      },
      {
        commandId: "fixture.echo",
        pluginId: "dev.tooldeck.fixture",
        source: "baseline-before-rebuild",
        status: "success",
      },
    ]);
  });

  it("records result and thrown failures while preserving command failure over history failure", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    await writeFixturePlugin(paths.builtinPluginsDir);
    const application = createTooldeckApplication({ paths });

    applications.push(application);
    await application.start();

    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "result-error" },
        source: "result-error-test",
      }),
    ).resolves.toEqual({
      status: "error",
      blocks: [],
      error: { code: "EXPECTED_FAILURE", message: "Fixture returned an error result." },
    });

    await expect(
      application.commands.run({
        commandId: "fixture.echo",
        input: { text: "throw" },
        source: "throw-test",
      }),
    ).rejects.toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation failed unexpectedly.",
    });

    const historyBeforeSkippedRun = await application.history.listCommandRuns();

    await application.commands.run({
      commandId: "fixture.echo",
      input: { text: "not-recorded" },
      source: "skip-history-test",
      recordHistory: false,
    });

    await expect(application.history.listCommandRuns()).resolves.toHaveLength(
      historyBeforeSkippedRun.length,
    );
    expect(historyBeforeSkippedRun).toMatchObject([
      {
        source: "throw-test",
        status: "error",
        error: {
          source: "application",
          code: "ERR_UNKNOWN",
        },
      },
      {
        source: "result-error-test",
        status: "error",
        output: {
          status: "error",
          error: { code: "EXPECTED_FAILURE" },
        },
      },
    ]);

    const create = vi.spyOn(CommandRunRepository.prototype, "create").mockImplementationOnce(() => {
      throw new Error("forced command history failure");
    });

    try {
      const error = await application.commands
        .run({
          commandId: "fixture.missing",
          input: { text: "throw" },
          source: "dual-failure-test",
        })
        .catch((caught) => caught);

      expect(error).toMatchObject({
        source: "runtime",
        code: "ERR_COMMAND_NOT_FOUND",
        cause: {
          message: "Command execution and command history persistence both failed.",
          errors: [
            expect.objectContaining({ source: "runtime", code: "ERR_COMMAND_NOT_FOUND" }),
            expect.objectContaining({
              source: "application",
              code: "ERR_UNKNOWN",
              message: "forced command history failure",
            }),
          ],
        },
      });
    } finally {
      create.mockRestore();
    }
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
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "application.dispose",
            context: {},
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              details: {
                cleanupFailures: [
                  {
                    phase: "cleanup",
                    step: "runtime.dispose",
                    error: {
                      source: "runtime",
                      code: "ERR_PLUGIN_LOAD_FAILED",
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
  });

  it("preserves startup failure and nests partial-resource cleanup diagnostics", async () => {
    const rootDir = createTempDir();
    const paths = createPaths(rootDir);
    const missingExternalDir = path.join(rootDir, "missing-external-plugins");
    const originalClose = DatabaseSync.prototype.close;
    const close = vi
      .spyOn(DatabaseSync.prototype, "close")
      .mockImplementation(function (this: DatabaseSync) {
        originalClose.call(this);
        throw new Error("forced startup database close failure");
      });
    const application = createTooldeckApplication({
      paths,
      pluginSources: [{ kind: "external", path: missingExternalDir }],
    });

    applications.push(application);

    try {
      await expect(application.start()).rejects.toMatchObject({
        source: "application",
        code: "ERR_UNKNOWN",
        message: "Application operation failed unexpectedly.",
        details: {
          cleanupFailures: [
            {
              phase: "cleanup",
              step: "applicationResources.dispose",
              context: {},
              error: {
                source: "application",
                code: "ERR_UNKNOWN",
                details: {
                  cleanupFailures: [
                    {
                      phase: "cleanup",
                      step: "database.close",
                      context: {},
                      error: {
                        source: "application",
                        code: "ERR_UNKNOWN",
                        message: "forced startup database close failure",
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      });
    } finally {
      close.mockRestore();
    }
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
      '      context.commands.register("fixture.echo", (input) => {',
      '        if (input.text === "throw") {',
      '          throw new Error("Fixture command failed.");',
      "        }",
      '        if (input.text === "result-error") {',
      "          return {",
      '            status: "error",',
      "            blocks: [],",
      '            error: { code: "EXPECTED_FAILURE", message: "Fixture returned an error result." },',
      "          };",
      "        }",
      "        return {",
      '          status: "success",',
      '          blocks: [{ type: "text", text: String(input.text) }],',
      "        };",
      "      }),",
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
