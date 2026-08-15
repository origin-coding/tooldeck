import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTooldeckApplication, type TooldeckApplication, type TooldeckPaths } from "@/index";

import {
  internalBoundaryFailureFixtures,
  internalBoundarySuccessFixtures,
  type ApplicationBoundaryOperation,
} from "../../../tests/fixtures/internal-schema-boundaries";

describe("Application request decoding contract", () => {
  let application: TooldeckApplication;
  let rootDir: string;

  beforeAll(async () => {
    rootDir = mkdtempSync(path.join(tmpdir(), "tooldeck-application-decoding-"));
    application = createTooldeckApplication({
      paths: createPaths(rootDir),
      pluginSources: [],
    });
    await application.start();
  });

  afterAll(async () => {
    try {
      await application.dispose();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps the shared boundary fixtures JSON-safe", () => {
    const fixtures = [...internalBoundarySuccessFixtures, ...internalBoundaryFailureFixtures];

    expect(JSON.parse(JSON.stringify(fixtures))).toEqual(fixtures);
  });

  for (const fixture of internalBoundarySuccessFixtures) {
    it(`preserves the accepted request shape: ${fixture.id}`, async () => {
      await expect(
        invokeApplicationBoundary(application, fixture.operation, fixture.request),
      ).resolves.not.toThrow();
    });
  }

  // These are executable RED contracts. Remove `.fails` as each Schema-backed
  // decoder lands and the corresponding contract starts passing.
  for (const fixture of internalBoundaryFailureFixtures) {
    it.fails(`rejects invalid request data with a stable path: ${fixture.id}`, async () => {
      await expect(
        invokeApplicationBoundary(application, fixture.operation, fixture.request),
      ).rejects.toMatchObject({
        source: "application",
        code: "ERR_INVALID_ARGUMENT",
        details: {
          operation: fixture.operation,
          issues: expect.arrayContaining([
            expect.objectContaining({
              path: fixture.expectedPath,
            }),
          ]),
        },
      });
    });
  }
});

function invokeApplicationBoundary(
  application: TooldeckApplication,
  operation: ApplicationBoundaryOperation,
  input: unknown,
): Promise<unknown> {
  const request = input as Record<string, unknown>;

  switch (operation) {
    case "commands.list":
      return Reflect.apply(application.commands.list, application.commands, [input]);
    case "commands.run":
      return Reflect.apply(application.commands.run, application.commands, [input]);
    case "plugins.list":
      return Reflect.apply(application.plugins.list, application.plugins, [input]);
    case "plugins.rescan":
      return Reflect.apply(application.plugins.rescan, application.plugins, [input]);
    case "plugins.setEnabled":
      return Reflect.apply(application.plugins.setEnabled, application.plugins, [
        request.pluginId,
        request.enabled,
        { locale: request.locale },
      ]);
    case "plugins.installPackage":
      return Reflect.apply(application.plugins.installPackage, application.plugins, [
        request.packagePath,
        { locale: request.locale },
      ]);
    case "plugins.uninstall":
      return Reflect.apply(application.plugins.uninstall, application.plugins, [
        request.pluginId,
        { locale: request.locale },
      ]);
    case "plugins.purgeData":
      return Reflect.apply(application.plugins.purgeData, application.plugins, [request.pluginId]);
    case "preferences.list":
      return Reflect.apply(application.preferences.list, application.preferences, [input]);
    case "preferences.get":
      return Reflect.apply(application.preferences.get, application.preferences, [input]);
    case "preferences.set":
      return Reflect.apply(application.preferences.set, application.preferences, [input]);
    case "preferences.delete":
      return Reflect.apply(application.preferences.delete, application.preferences, [input]);
    case "history.listRuns":
      return Reflect.apply(application.history.listCommandRuns, application.history, [input]);
  }
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
