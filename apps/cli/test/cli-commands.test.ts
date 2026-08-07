import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { isApplicationError } from "@tooldeck/application-node";
import { expect, it, describe } from "vitest";

import {
  listCliCommands,
  normalizeListCliResource,
  runCliCommandWithStorage,
  withCliApplication,
} from "../src/cli";
import {
  createDatabasePath,
  createEchoPlugin,
  createTempDir,
  readCommandRuns,
} from "./cli-test-fixtures";

describe("CLI command catalog", () => {
  it("runs hello.world from the default plugin directory shape", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await withCliApplication({ pluginsRoot, storagePath }, async (application) => {
      await expect(
        application.commands.run({
          commandId: "hello.world",
          source: "cli",
          recordHistory: false,
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      });

      await expect(application.plugins.list()).resolves.not.toHaveLength(0);
      await expect(application.commands.list()).resolves.not.toHaveLength(0);
    });
  });

  it("returns no plugins for an empty plugin directory", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");
    const storagePath = createDatabasePath();

    await mkdir(pluginsRoot, { recursive: true });

    await withCliApplication({ pluginsRoot, storagePath }, async (application) => {
      await expect(application.plugins.list()).resolves.toHaveLength(0);
      await expect(application.commands.list()).resolves.toHaveLength(0);
    });
  });

  it("lists no commands for an empty plugin directory", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");

    await mkdir(pluginsRoot, { recursive: true });

    await expect(listCliCommands({ pluginsRoot })).resolves.toEqual([]);
  });

  it("normalizes list resources and rejects unsupported resources", () => {
    expect(normalizeListCliResource()).toBe("commands");
    expect(normalizeListCliResource("command")).toBe("commands");
    expect(normalizeListCliResource("commands")).toBe("commands");
    expect(normalizeListCliResource("plugin")).toBe("plugins");
    expect(normalizeListCliResource("plugins")).toBe("plugins");
    expect(normalizeListCliResource("preference")).toBe("preferences");
    expect(normalizeListCliResource("preferences")).toBe("preferences");
    expect(normalizeListCliResource("documents")).toBeUndefined();
  });

  it("lists manifest commands without activating plugin code", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "list-test");
    const activationMarkerPath = path.join(pluginRoot, "activated.txt");

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.list-test",
        name: "List Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "list.localized",
              title: {
                key: "commands.localized.title",
                default: "Localized Command",
              },
            },
            {
              id: "list.string",
              title: "String Command",
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

        await writeFile(${JSON.stringify(activationMarkerPath)}, "activated", "utf8");

        export default {
          activate() {},
        };
      `,
      "utf8",
    );

    await expect(listCliCommands({ pluginsRoot })).resolves.toEqual([
      {
        id: "list.localized",
        pluginId: "dev.tooldeck.list-test",
        title: "Localized Command",
      },
      {
        id: "list.string",
        pluginId: "dev.tooldeck.list-test",
        title: "String Command",
      },
    ]);
    expect(existsSync(activationMarkerPath)).toBe(false);
  });

  it("lists and runs commands from additional plugin sources", async () => {
    const builtinRoot = path.resolve("../..", "plugins");
    const externalRoot = path.join(createTempDir(), "external-echo");
    const storagePath = createDatabasePath();
    const pluginSources = [
      {
        kind: "builtin" as const,
        path: builtinRoot,
      },
      {
        kind: "external" as const,
        path: externalRoot,
      },
    ];

    await createEchoPlugin({
      commandId: "external.echo",
      pluginId: "dev.tooldeck.external-echo",
      pluginRoot: externalRoot,
      responseText: "external ok",
    });

    await expect(listCliCommands({ pluginSources })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hello.world",
          pluginId: "dev.tooldeck.hello-world",
        }),
        expect.objectContaining({
          id: "external.echo",
          pluginId: "dev.tooldeck.external-echo",
        }),
      ]),
    );

    await expect(
      runCliCommandWithStorage({
        commandId: "external.echo",
        pluginSources,
        storagePath,
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

    expect(readCommandRuns(storagePath)).toEqual([
      expect.objectContaining({
        commandId: "external.echo",
        pluginId: "dev.tooldeck.external-echo",
        source: "cli",
        status: "success",
      }),
    ]);
  });

  it("preserves command and plugin cleanup failures", async () => {
    const pluginRoot = path.join(createTempDir(), "cleanup-failure");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.cleanup-failure",
        name: "Cleanup Failure",
        version: "0.0.0",
        runtime: { kind: "node", entry: "./index.mjs" },
        contributes: {
          commands: [{ id: "cleanup.fail", title: "Fail with cleanup error" }],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        export default {
          activate(ctx) {
            ctx.subscriptions.push(
              ctx.commands.register("cleanup.fail", () => {
                throw new Error("command failed at source");
              }),
            );
          },
          deactivate() {
            throw new Error("deactivate failed at source");
          },
        };
      `,
      "utf8",
    );

    const error = await runCliCommandWithStorage({
      commandId: "cleanup.fail",
      pluginSources: [{ kind: "external", path: pluginRoot }],
      storagePath,
    }).catch((caught: unknown) => caught);

    expect(isApplicationError(error, "ERR_UNKNOWN")).toBe(true);
    expect(error).toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation failed unexpectedly.",
      details: expect.objectContaining({
        cleanupFailures: [
          expect.objectContaining({
            phase: "cleanup",
            step: "application.dispose",
            error: expect.objectContaining({
              source: "application",
              code: "ERR_UNKNOWN",
            }),
          }),
        ],
      }),
      cause: expect.any(AggregateError),
    });
    expect(readCommandRuns(storagePath)).toEqual([
      expect.objectContaining({
        commandId: "cleanup.fail",
        status: "error",
        errorJson: expect.stringContaining("Application operation failed unexpectedly."),
      }),
    ]);
    expect(readCommandRuns(storagePath)[0]?.errorJson).not.toContain("command failed at source");
    expect(readCommandRuns(storagePath)[0]?.errorJson).not.toContain("cleanupFailures");
  });

  it("persists canonical activation cleanup diagnostics observed at the command boundary", async () => {
    const pluginRoot = path.join(createTempDir(), "activation-cleanup-failure");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.activation-cleanup-failure",
        name: "Activation Cleanup Failure",
        version: "0.0.0",
        runtime: { kind: "node", entry: "./index.mjs" },
        contributes: {
          commands: [{ id: "activation-cleanup.fail", title: "Fail during activation" }],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        export default {
          activate(ctx) {
            ctx.subscriptions.push({
              dispose() {
                throw new Error("activation subscription cleanup failed");
              },
            });
            throw new Error("activation failed at source");
          },
        };
      `,
      "utf8",
    );

    await expect(
      runCliCommandWithStorage({
        commandId: "activation-cleanup.fail",
        pluginSources: [{ kind: "external", path: pluginRoot }],
        storagePath,
      }),
    ).rejects.toMatchObject({
      source: "runtime",
      code: "ERR_PLUGIN_LOAD_FAILED",
      details: {
        cleanupFailures: [
          {
            step: "subscriptions.dispose",
            error: {
              details: {
                cleanupFailures: [{ step: "subscription.dispose" }],
              },
            },
          },
        ],
      },
    });

    const [run] = readCommandRuns(storagePath);
    const historyError = JSON.parse(run?.errorJson ?? "null");

    expect(historyError).toMatchObject({
      tag: "ApplicationError",
      source: "runtime",
      code: "ERR_PLUGIN_LOAD_FAILED",
      details: {
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "subscriptions.dispose",
            context: { pluginId: "dev.tooldeck.activation-cleanup-failure" },
            error: {
              source: "runtime",
              details: {
                cleanupFailures: [
                  {
                    step: "subscription.dispose",
                    error: { message: "activation subscription cleanup failed" },
                  },
                ],
              },
            },
          },
        ],
      },
    });
    expect(run?.errorJson).not.toMatch(/"(?:stack|cause|errors)"/);
  });
});
