import path from "node:path";

import type { TooldeckApplication } from "@tooldeck/application-node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { internalBoundaryFailureFixtures } from "../../../../tests/fixtures/internal-schema-boundaries";

const electron = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electron.handle,
    removeHandler: electron.removeHandler,
  },
}));

import { registerTooldeckIpc } from "@/main/ipc";

describe("registerTooldeckIpc", () => {
  beforeEach(() => {
    electron.handle.mockReset();
    electron.removeHandler.mockReset();
  });

  it("forwards domain operations and returns JSON-safe success envelopes", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const packagePath = path.resolve("plugins", "plugin.tdplugin");
    const installPackage = vi.fn().mockResolvedValue({
      status: "installed-refresh-failed",
      installedPluginId: "dev.example.plugin",
      packageName: "plugin.tdplugin",
      refreshError: "refresh failed",
    });

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));

    registerTooldeckIpc({
      plugins: {
        installPackage,
      },
    } as unknown as TooldeckApplication);

    await expect(
      handlers.get("tooldeck:install-plugin-package")?.(
        {},
        {
          packagePath,
          locale: "zh-CN",
        },
      ),
    ).resolves.toEqual({
      ok: true,
      value: {
        status: "installed-refresh-failed",
        installedPluginId: "dev.example.plugin",
        packageName: "plugin.tdplugin",
        refreshError: "refresh failed",
      },
    });
    expect(installPackage).toHaveBeenCalledWith(packagePath, {
      locale: "zh-CN",
    });
  });

  it("returns retained cleanup as a successful IPC result with canonical diagnostics", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const uninstall = vi.fn().mockResolvedValue({
      cleanupPending: true,
      cleanupFailures: [
        {
          phase: "cleanup",
          step: "pluginQuarantine.remove",
          context: {
            pluginId: "dev.example.plugin",
            stagingEntry: "uninstall-example",
          },
          error: {
            source: "application",
            code: "ERR_UNKNOWN",
            message: "file is locked",
          },
        },
      ],
      filesMissing: false,
      pluginId: "dev.example.plugin",
      install: {},
      catalog: { commands: [], plugins: [] },
      residues: [],
    });

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));
    registerTooldeckIpc({ plugins: { uninstall } } as unknown as TooldeckApplication);

    await expect(
      handlers.get("tooldeck:uninstall-plugin")?.(
        {},
        { pluginId: "dev.example.plugin", locale: "en-US" },
      ),
    ).resolves.toEqual({
      ok: true,
      value: {
        cleanupPending: true,
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "pluginQuarantine.remove",
            context: {
              pluginId: "dev.example.plugin",
              stagingEntry: "uninstall-example",
            },
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "file is locked",
            },
          },
        ],
        commands: [],
        filesMissing: false,
        pluginId: "dev.example.plugin",
        plugins: [],
        residues: [],
      },
    });
  });

  it("serializes application failures instead of throwing raw errors across IPC", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));

    registerTooldeckIpc({
      commands: {
        run: vi.fn().mockRejectedValue(new Error("command failed")),
      },
    } as unknown as TooldeckApplication);

    await expect(
      handlers.get("tooldeck:run-command")?.({}, { commandId: "fixture.fail" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        tag: "ApplicationError",
        source: "application",
        code: "ERR_UNKNOWN",
        message: "command failed",
      },
    });
  });

  it("removes handlers registered before a later registration fails", () => {
    electron.handle
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error("duplicate IPC handler");
      });

    expect(() => registerTooldeckIpc({} as TooldeckApplication)).toThrow("duplicate IPC handler");
    expect(electron.removeHandler).toHaveBeenCalledTimes(1);
    expect(electron.removeHandler).toHaveBeenCalledWith("tooldeck:list-commands");
  });

  it("registers every request-bearing IPC channel covered by the shared fixtures", () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));
    registerTooldeckIpc(createRejectingApplication().application);

    const coveredChannels = new Set(
      internalBoundaryFailureFixtures.flatMap((fixture) =>
        fixture.desktopChannel ? [fixture.desktopChannel] : [],
      ),
    );

    expect(coveredChannels).toEqual(
      new Set([
        "tooldeck:list-commands",
        "tooldeck:run-command",
        "tooldeck:list-plugins",
        "tooldeck:set-plugin-enabled",
        "tooldeck:install-plugin-package",
        "tooldeck:uninstall-plugin",
        "tooldeck:purge-plugin-data",
        "tooldeck:rescan-plugins",
        "tooldeck:get-preference",
        "tooldeck:set-preference",
        "tooldeck:list-command-runs",
      ]),
    );
    expect([...coveredChannels].every((channel) => handlers.has(channel))).toBe(true);
  });

  for (const fixture of internalBoundaryFailureFixtures.filter(
    (candidate) => candidate.desktopChannel !== undefined,
  )) {
    it(`decodes IPC requests before dispatch: ${fixture.id}`, async () => {
      const handlers = new Map<string, (...args: unknown[]) => unknown>();
      const { application, calls } = createRejectingApplication();

      electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));
      registerTooldeckIpc(application);

      const handler = handlers.get(fixture.desktopChannel!);
      const result = await handler?.({}, fixture.request);

      expect(calls.every((call) => call.mock.calls.length === 0)).toBe(true);
      expect(result).toMatchObject({
        ok: false,
        error: {
          tag: "ApplicationError",
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
        },
      });
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });
  }
});

function createRejectingApplication(): {
  application: TooldeckApplication;
  calls: ReturnType<typeof vi.fn>[];
} {
  const calls: ReturnType<typeof vi.fn>[] = [];
  const reject = () => {
    const operation = vi.fn().mockRejectedValue(new Error("Application handler must not run."));
    calls.push(operation);
    return operation;
  };

  return {
    application: {
      commands: {
        list: reject(),
        run: reject(),
      },
      plugins: {
        list: reject(),
        listDataResidues: reject(),
        setEnabled: reject(),
        installPackage: reject(),
        uninstall: reject(),
        purgeData: reject(),
        rescan: reject(),
      },
      preferences: {
        list: reject(),
        get: reject(),
        set: reject(),
        delete: reject(),
      },
      history: {
        listCommandRuns: reject(),
      },
    } as unknown as TooldeckApplication,
    calls,
  };
}
