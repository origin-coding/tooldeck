import path from "node:path";

import { describe, expect, it } from "vitest";

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

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}
