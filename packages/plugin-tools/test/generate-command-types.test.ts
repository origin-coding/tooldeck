import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";
import { runCommand } from "citty";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPluginToolsCommand,
  generateCommandTypesFile,
  generatePluginCommandTypes,
  runGenerateCommandTypesCli,
} from "../src";

const tempDirs: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("generatePluginCommandTypes", () => {
  it("wraps enum unions before array suffixes", async () => {
    const manifest = createManifest([
      {
        id: "test.controls",
        title: "Test Controls",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            flags: {
              type: "array",
              items: {
                type: "string",
                enum: ["g", "i"],
              },
            },
          },
        },
      },
    ]);

    await expect(generatePluginCommandTypes(manifest)).resolves.toContain('flags?: ("g" | "i")[];');
  });

  it("generates command id constants", async () => {
    const manifest = createManifest([
      {
        id: "json.format",
        title: "Format JSON",
      },
    ]);

    await expect(generatePluginCommandTypes(manifest)).resolves.toContain(
      'export const commandIds = {\n  jsonFormat: "json.format",\n} as const;',
    );
  });

  it("generates a default object input type when inputSchema is omitted", async () => {
    const manifest = createManifest([
      {
        id: "json.format",
        title: "Format JSON",
      },
    ]);

    await expect(generatePluginCommandTypes(manifest)).resolves.toContain(
      "export interface JsonFormatInput {\n  [k: string]: unknown;\n}",
    );
  });

  it("does not generate standalone property types from schema titles", async () => {
    const manifest = createManifest([
      {
        id: "text.first",
        title: "First Text",
        inputSchema: {
          type: "object",
          required: ["text"],
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              title: "Text",
              description: "Text shown in the command form.",
              "x-i18n": {
                title: "schema.text.title",
              },
            },
          },
        },
      },
      {
        id: "text.second",
        title: "Second Text",
        inputSchema: {
          type: "object",
          required: ["text"],
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              title: "Text",
            },
          },
        },
      },
    ]);
    const output = await generatePluginCommandTypes(manifest);

    expect(output).not.toContain("export type Text");
    expect(output).toContain("export interface TextFirstInput {\n  text: string;\n}");
    expect(output).toContain("export interface TextSecondInput {\n  text: string;\n}");
  });

  it("rejects command id constant key conflicts", async () => {
    const manifest = createManifest([
      {
        id: "json.format",
        title: "Format JSON",
      },
      {
        id: "json-format",
        title: "Format JSON Again",
      },
    ]);

    await expect(generatePluginCommandTypes(manifest)).rejects.toThrow(
      'Generated commandIds key "jsonFormat" conflicts for command ids: json.format, json-format',
    );
  });
});

describe("generate command type files", () => {
  it("uses manifest.json and src/generated/commands.ts by default", async () => {
    const projectDir = createTempDir();

    process.chdir(projectDir);
    await writeManifest(path.join(projectDir, "manifest.json"));
    await mkdir(path.join(projectDir, "src"), { recursive: true });
    await writeFile(path.join(projectDir, "src", "index.ts"), "throw new Error('do not load');");

    await generateCommandTypesFile();

    await expect(
      readFile(path.join(projectDir, "src", "generated", "commands.ts"), "utf8"),
    ).resolves.toContain('jsonFormat: "json.format"');
  });

  it("uses explicit --manifest and --out arguments", async () => {
    const projectDir = createTempDir();
    const manifestPath = path.join(projectDir, "plugin.manifest.json");
    const outputPath = path.join(projectDir, "generated", "command-types.ts");

    await writeManifest(manifestPath);
    await runGenerateCommandTypesCli(["--manifest", manifestPath, "--out", outputPath]);

    await expect(readFile(outputPath, "utf8")).resolves.toContain(
      '"json.format": JsonFormatInput;',
    );
  });

  it("resolves schema refs relative to the manifest path", async () => {
    const projectDir = createTempDir();
    const manifestPath = path.join(projectDir, "manifest.json");
    const outputPath = path.join(projectDir, "generated", "commands.ts");

    await mkdir(path.join(projectDir, "schemas"), { recursive: true });
    await writeFile(
      path.join(projectDir, "schemas", "json-format-input.schema.json"),
      JSON.stringify({
        type: "object",
        required: ["text"],
        additionalProperties: false,
        properties: {
          text: {
            type: "string",
          },
        },
      }),
      "utf8",
    );
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify(
        createManifest([
          {
            id: "json.format",
            title: "Format JSON",
            inputSchema: {
              $ref: "./schemas/json-format-input.schema.json",
            },
          },
        ]),
      ),
      "utf8",
    );

    await runGenerateCommandTypesCli(["--manifest", manifestPath, "--out", outputPath]);

    await expect(readFile(outputPath, "utf8")).resolves.toContain("text: string;");
  });

  it("rejects positional arguments", async () => {
    await expect(
      runGenerateCommandTypesCli(["manifest.json", "src/generated/commands.ts"]),
    ).rejects.toThrow("Unsupported argument: manifest.json");
  });

  it("runs tooldeck-plugin generate as the types generator", async () => {
    const projectDir = createTempDir();
    const manifestPath = path.join(projectDir, "manifest.json");
    const outputPath = path.join(projectDir, "commands.ts");

    await writeManifest(manifestPath);
    await runCommand(createPluginToolsCommand(), {
      rawArgs: ["generate", "--manifest", manifestPath, "--out", outputPath],
    });

    await expect(readFile(outputPath, "utf8")).resolves.toContain('jsonFormat: "json.format"');
  });

  it("runs tooldeck-plugin generate types with the same arguments", async () => {
    const projectDir = createTempDir();
    const manifestPath = path.join(projectDir, "manifest.json");
    const outputPath = path.join(projectDir, "commands.ts");

    await writeManifest(manifestPath);
    await runCommand(createPluginToolsCommand(), {
      rawArgs: ["generate", "types", "--manifest", manifestPath, "--out", outputPath],
    });

    await expect(readFile(outputPath, "utf8")).resolves.toContain('jsonFormat: "json.format"');
  });
});

function createManifest(
  commands: NonNullable<NonNullable<PluginManifest["contributes"]>["commands"]>,
): PluginManifest {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.test-tools",
    name: "Test Tools",
    version: "0.0.0",
    runtime: {
      kind: "node",
      entry: "./dist/index.js",
    },
    contributes: {
      commands,
    },
  };
}

async function writeManifest(manifestPath: string): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      createManifest([
        {
          id: "json.format",
          title: "Format JSON",
          inputSchema: {
            type: "object",
            required: ["text"],
            additionalProperties: false,
            properties: {
              text: {
                type: "string",
              },
            },
          },
        },
      ]),
    ),
    "utf8",
  );
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-tools-"));

  tempDirs.push(dir);

  return dir;
}
