import path from "node:path";

import { consola } from "consola";
import { describe, expect, it, vi } from "vitest";

import { printContentBlocks } from "../src/cli";
import { formatCommandList, formatPluginList } from "../src/output";

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
      },
      {
        id: "dev.tooldeck.disabled",
        enabled: false,
        version: "0.0.1",
        name: "Disabled Plugin",
        manifestPath: path.join(process.cwd(), "plugins", "disabled", "manifest.json"),
      },
    ]);

    expect(output).toContain("2 plugins");
    expect(output).toContain("enabled");
    expect(output).toContain("disabled");
    expect(output).toContain("dev.tooldeck.json-tools");
    expect(output).toContain(path.join("plugins", "json-tools", "manifest.json"));
  });

  it("formats empty lists without table headers", () => {
    expect(stripAnsi(formatCommandList([]))).toBe("No commands found.");
    expect(stripAnsi(formatPluginList([]))).toBe("No plugins found.");
  });
});

describe("CLI command output", () => {
  it("prints text, code, json, and properties content blocks", () => {
    const log = vi.spyOn(consola, "log").mockImplementation(() => undefined);

    try {
      printContentBlocks({
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
      printContentBlocks(
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
});

const ESC = String.fromCharCode(27);
const ANSI_ESCAPE_REGEXP = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g");

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEXP, "");
}
