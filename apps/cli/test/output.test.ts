import path from "node:path";

import { consola } from "consola";
import { describe, expect, it, vi } from "vitest";

import {
  printCommandResult,
  printPluginInstall,
  printPluginPurge,
  printPluginUninstall,
} from "../src/cli";
import {
  formatCommandList,
  formatPluginInstall,
  formatPluginList,
  formatPluginPurge,
  formatPluginUninstall,
} from "../src/output";

describe("CLI list output", () => {
  it("formats command lists as aligned table output", () => {
    const output = formatCommandList([
      {
        id: "json.format",
        pluginId: "dev.tooldeck.json-tools",
        title: "Format JSON",
        description: "Format JSON text with configurable indentation.",
      },
    ]);

    expect(output).toContain("1 command");
    expect(output).toContain("Command");
    expect(output).toContain("json.format");
    expect(output).toContain("Format JSON");
    expect(output).toContain("dev.tooldeck.json-tools");
    expect(output).toContain("Format JSON text with configurable indentation.");
  });

  it("formats plugin lists with friendly status text", () => {
    const output = formatPluginList([
      {
        id: "dev.tooldeck.json-tools",
        enabled: true,
        version: "0.0.0",
        name: "JSON Tools",
        manifestPath: path.join(process.cwd(), "plugins", "json-tools", "manifest.json"),
        sourceKind: "builtin",
      },
      {
        id: "dev.tooldeck.disabled",
        enabled: false,
        version: "0.0.1",
        name: "Disabled Plugin",
        manifestPath: path.join(process.cwd(), "plugins", "disabled", "manifest.json"),
        sourceKind: "external",
      },
    ]);

    expect(output).toContain("2 plugins");
    expect(output).toContain("enabled");
    expect(output).toContain("disabled");
    expect(output).toContain("builtin");
    expect(output).toContain("external");
    expect(output).toContain("dev.tooldeck.json-tools");
    expect(output).toContain(path.join("plugins", "json-tools", "manifest.json"));
  });

  it("formats install and uninstall summaries", () => {
    const installed = formatPluginInstall({
      id: "dev.example.echo",
      enabled: true,
      version: "0.1.0",
      name: "Echo",
      sourceKind: "installed",
      manifestPath: path.join("installed-plugins", "dev.example.echo", "manifest.json"),
      installDir: path.join("installed-plugins", "dev.example.echo"),
      packageDigest: "abc123",
      packageName: "dev.example.echo-0.1.0.tdplugin",
      packageSizeBytes: 123,
    });
    const uninstalled = formatPluginUninstall({
      id: "dev.example.echo",
      version: "0.1.0",
      installDir: path.join("installed-plugins", "dev.example.echo"),
      filesMissing: false,
      cleanupPending: true,
      cleanupError: "file is locked",
    });
    const purged = formatPluginPurge({
      id: "dev.example.echo",
      stateRemoved: true,
      kvEntriesRemoved: 2,
    });

    expect(installed).toContain("Installed dev.example.echo.");
    expect(installed).toContain("installed");
    expect(installed).toContain("dev.example.echo-0.1.0.tdplugin");
    expect(uninstalled).toContain("Uninstalled dev.example.echo.");
    expect(uninstalled).toContain("cleanup is pending");
    expect(uninstalled).toContain("file is locked");
    expect(purged).toContain("Purged local data for dev.example.echo.");
    expect(purged).toContain("2 plugin-scoped KV entries removed.");
    expect(purged).toContain("Command history was preserved.");
  });

  it("formats empty lists without table headers", () => {
    expect(stripAnsi(formatCommandList([]))).toBe("No commands found.");
    expect(stripAnsi(formatPluginList([]))).toBe("No plugins found.");
  });
});

describe("CLI command output", () => {
  it("prints install, uninstall, and purge summaries as JSON", () => {
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      printPluginInstall(
        {
          id: "dev.example.echo",
          enabled: true,
          version: "0.1.0",
          name: "Echo",
          sourceKind: "installed",
          manifestPath: "C:/tooldeck/installed-plugins/dev.example.echo/manifest.json",
          installDir: "C:/tooldeck/installed-plugins/dev.example.echo",
          packageDigest: "abc123",
          packageName: "dev.example.echo-0.1.0.tdplugin",
          packageSizeBytes: 123,
        },
        "json",
      );
      printPluginUninstall(
        {
          id: "dev.example.echo",
          version: "0.1.0",
          installDir: "C:/tooldeck/installed-plugins/dev.example.echo",
          filesMissing: false,
          cleanupPending: false,
        },
        "json",
      );
      printPluginPurge(
        {
          id: "dev.example.echo",
          stateRemoved: true,
          kvEntriesRemoved: 2,
        },
        "json",
      );

      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
        id: "dev.example.echo",
        sourceKind: "installed",
      });
      expect(JSON.parse(String(log.mock.calls[1]?.[0]))).toMatchObject({
        id: "dev.example.echo",
        cleanupPending: false,
      });
      expect(JSON.parse(String(log.mock.calls[2]?.[0]))).toEqual({
        id: "dev.example.echo",
        stateRemoved: true,
        kvEntriesRemoved: 2,
      });
    } finally {
      log.mockRestore();
    }
  });

  it("prints text, code, json, and properties content blocks", () => {
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      printCommandResult({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "plain output",
          },
          {
            type: "code",
            text: "const value = 1;",
            language: "ts",
          },
          {
            type: "json",
            value: {
              a: 1,
            },
          },
          {
            type: "properties",
            items: [
              {
                label: "Valid",
                value: true,
              },
              {
                label: {
                  key: "result.size.label",
                  default: "Size",
                },
                value: 12,
                note: "bytes",
              },
            ],
          },
        ],
      });

      expect(log).toHaveBeenCalledTimes(4);
      expect(log).toHaveBeenNthCalledWith(1, "plain output");
      expect(log).toHaveBeenNthCalledWith(2, "const value = 1;");
      expect(log).toHaveBeenNthCalledWith(3, '{\n  "a": 1\n}');
      expect(log).toHaveBeenNthCalledWith(4, "Valid: true\nSize: 12 (bytes)");
    } finally {
      log.mockRestore();
    }
  });

  it("prints command results as JSON when requested", () => {
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      printCommandResult(
        {
          status: "success",
          blocks: [
            {
              type: "text",
              text: "plain output",
            },
          ],
        },
        "json",
      );

      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "plain output",
          },
        ],
      });
    } finally {
      log.mockRestore();
    }
  });

  it("sets a failing exit code for error command results", () => {
    const previousExitCode = process.exitCode;
    const error = vi.spyOn(consola, "error").mockImplementation(() => undefined);

    try {
      process.exitCode = undefined;

      printCommandResult({
        status: "error",
        blocks: [],
        error: {
          code: "ERR_TEST",
          message: "Command failed with details.",
        },
      });

      expect(process.exitCode).toBe(1);
      expect(error).toHaveBeenCalledWith("Command failed with details.");
    } finally {
      process.exitCode = previousExitCode;
      error.mockRestore();
    }
  });

  it("keeps structured error results in JSON output", () => {
    const previousExitCode = process.exitCode;
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      process.exitCode = undefined;

      printCommandResult(
        {
          status: "error",
          blocks: [],
          error: {
            code: "ERR_TEST",
            message: "Command failed with details.",
          },
        },
        "json",
      );

      expect(process.exitCode).toBe(1);
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
        status: "error",
        blocks: [],
        error: {
          code: "ERR_TEST",
          message: "Command failed with details.",
        },
      });
    } finally {
      process.exitCode = previousExitCode;
      log.mockRestore();
    }
  });
});

const ESC = String.fromCharCode(27);
const ANSI_ESCAPE_REGEXP = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g");

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEXP, "");
}
