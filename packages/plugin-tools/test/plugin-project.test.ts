import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";
import { runCommand } from "citty";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildPluginProject,
  checkPluginProject,
  createPluginToolsCommand,
  formatPluginCheckResult,
  formatPluginInspection,
  generatePluginCommandTypesFile,
  inspectPluginProject,
  distPluginProject,
  packPluginProject,
  PluginBuildError,
} from "../src";

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalExitCode = process.exitCode;

afterEach(() => {
  process.chdir(originalCwd);
  process.exitCode = originalExitCode;

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("checkPluginProject", () => {
  it("passes for a generated plugin project", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("fails when generated command types are stale", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);
    await mkdir(path.join(projectDir, "src", "generated"), { recursive: true });
    await writeFile(path.join(projectDir, "src", "generated", "commands.ts"), "stale", "utf8");

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "GENERATED_STALE")).toBe(
      true,
    );
  });

  it("checks built ESM output without activating the plugin", async () => {
    const projectDir = await createPluginProject();
    const activationMarker = path.join(projectDir, "activated.txt").replaceAll("\\", "\\\\");

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(
      path.join(projectDir, "dist", "index.js"),
      `import { writeFileSync } from "node:fs";\nexport default { activate() { writeFileSync("${activationMarker}", "activated"); } };\n`,
      "utf8",
    );

    const result = await checkPluginProject({ built: true });

    expect(result.ok).toBe(true);
    expect(existsSync(path.join(projectDir, "activated.txt"))).toBe(false);
  });

  it("reports built output without a Tooldeck default export", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(path.join(projectDir, "dist", "index.js"), "export const value = 1;\n", "utf8");

    const result = await checkPluginProject({ built: true });

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "BUILT_PLUGIN_DEFAULT_EXPORT"),
    ).toBe(true);
  });

  it("requires @tooldeck/vite-plugin for Vite plugin projects", async () => {
    const projectDir = await createPluginProject({ includeVitePlugin: false });

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "PACKAGE_DEPENDENCY_MISSING" &&
          diagnostic.message.includes("@tooldeck/vite-plugin"),
      ),
    ).toBe(true);
  });

  it("rejects command input schemas outside the supported subset", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: {
        text: {
          type: "string",
        },
      },
      oneOf: [
        {
          required: ["text"],
        },
      ],
    } as never;
    const projectDir = await createPluginProject({ manifest });

    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_SCHEMA_UNSUPPORTED_KEYWORD" &&
          diagnostic.message.includes("oneOf") &&
          diagnostic.fieldPath === "contributes.commands[0].inputSchema.oneOf" &&
          diagnostic.suggestion?.includes("Remove oneOf"),
      ),
    ).toBe(true);
  });

  it("normalizes manifest schema errors into actionable diagnostics", async () => {
    const projectDir = await createPluginProject({
      manifest: {
        ...createManifest(),
        runtime: {
          kind: "node",
        },
      } as never,
    });

    process.chdir(projectDir);

    const result = await checkPluginProject();
    const diagnostic = result.diagnostics.find(
      (item) => item.code === "MANIFEST_SCHEMA" && item.fieldPath === "runtime.entry",
    );

    expect(diagnostic).toMatchObject({
      severity: "error",
      path: path.join(projectDir, "manifest.json"),
      message: "runtime.entry is required.",
      suggestion: 'Add "runtime.entry": "./dist/index.js".',
    });
    expect(formatPluginCheckResult(result)).toContain("Field: runtime.entry");
    expect(formatPluginCheckResult(result)).toContain(
      'Fix: Add "runtime.entry": "./dist/index.js".',
    );
  });

  it("rejects unsupported field x-ui properties for the selected control", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      required: ["text"],
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
          "x-ui": {
            control: "text",
            rows: 10,
          },
        },
      },
    } as never;
    const projectDir = await createPluginProject({ manifest });

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "INPUT_FIELD_X_UI" &&
          diagnostic.message.includes("rows") &&
          diagnostic.message.includes("text control"),
      ),
    ).toBe(true);
  });

  it("rejects malformed x-i18n enum labels", async () => {
    const manifest = createManifest();
    manifest.contributes!.commands![0]!.inputSchema = {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["compact", "pretty"],
          "x-i18n": {
            enumLabels: {
              compact: "schema.mode.compact",
              pretty: {
                key: "schema.mode.pretty",
                default: "Pretty",
              },
            },
          },
        },
      },
    } as never;
    const projectDir = await createPluginProject({ manifest });

    process.chdir(projectDir);

    const result = await checkPluginProject();

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SCHEMA_X_I18N" && diagnostic.message.includes("enumLabels.pretty"),
      ),
    ).toBe(true);
  });
});

describe("inspectPluginProject", () => {
  it("reports project details without importing runtime code", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(path.join(projectDir, "dist", "index.js"), "throw new Error('do not load');");

    const result = await inspectPluginProject();

    expect(result.plugin?.id).toBe("dev.tooldeck.test-tools");
    expect(result.commands).toEqual(["json.format"]);
    expect(result.buildOutput.exists).toBe(true);
  });

  it("formats inspect output as a sectioned diagnostic report", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);

    const result = await inspectPluginProject();
    const output = formatPluginInspection(result);

    expect(output).toContain("Summary\n");
    expect(output).toContain("Manifest\n");
    expect(output).toContain("Commands\n");
    expect(output).toContain("Locales\n");
    expect(output).toContain("Packages\n");
    expect(output).toContain("Diagnostics\n");
    expect(output).toContain("Status: [error] Project has errors.");
    expect(output).toContain("[ok] json.format");
    expect(output).toContain("Activation: onCommand:json.format");
    expect(output).toContain("[missing]");
    expect(output).toContain("Fix: Run tooldeck-plugin generate");
  });

  it("wires the inspect subcommand", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();

    await expect(
      runCommand(createPluginToolsCommand(), {
        rawArgs: ["inspect"],
      }),
    ).resolves.toEqual({ result: undefined });
  });

  it("sets an exit code when inspect finds error diagnostics", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);

    await expect(
      runCommand(createPluginToolsCommand(), {
        rawArgs: ["inspect"],
      }),
    ).resolves.toEqual({ result: undefined });
    expect(process.exitCode).toBe(1);
  });
});

describe("buildPluginProject", () => {
  it("runs generate, check, Vite build, and check --built", async () => {
    const projectDir = await createPluginProject();

    await writeFakeVite(projectDir);
    process.chdir(projectDir);

    const result = await buildPluginProject({ bundler: "vite" });

    expect(result.stages).toEqual(["generate", "check", "vite build", "check --built"]);
    expect(existsSync(path.join(projectDir, "src", "generated", "commands.ts"))).toBe(true);
    expect(existsSync(path.join(projectDir, "dist", "index.js"))).toBe(true);

    const checkResult = await checkPluginProject({ built: true });

    expect(checkResult.ok).toBe(true);
  });

  it("rejects unsupported bundlers before running build stages", async () => {
    const projectDir = await createPluginProject();

    process.chdir(projectDir);

    await expect(buildPluginProject({ bundler: "esbuild" })).rejects.toMatchObject({
      stage: "setup",
    } satisfies Partial<PluginBuildError>);
  });
});

describe("packPluginProject", () => {
  it("creates a .tdplugin package from built output", async () => {
    const projectDir = await createPluginProject();
    const outputPath = path.join(projectDir, "release.tdplugin");

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(
      path.join(projectDir, "dist", "index.js"),
      "export default { activate() {} };\n",
      "utf8",
    );

    const result = await packPluginProject({ outputPath });

    expect(result.packagePath).toBe(outputPath);
    expect(result.pluginId).toBe("dev.tooldeck.test-tools");
    expect(result.files).toContain("manifest.json");
    expect(result.files).toContain("tooldeck-package.json");
    expect(existsSync(outputPath)).toBe(true);
  });

  it("overwrites an existing output package path", async () => {
    const projectDir = await createPluginProject();
    const outputPath = path.join(projectDir, "release.tdplugin");

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(
      path.join(projectDir, "dist", "index.js"),
      "export default { activate() {} };\n",
      "utf8",
    );
    await writeFile(outputPath, "old package", "utf8");

    const result = await packPluginProject({ outputPath });

    expect(result.packagePath).toBe(outputPath);
    await expect(readFile(outputPath, "utf8")).resolves.not.toBe("old package");
  });

  it("wires the pack subcommand", async () => {
    const projectDir = await createPluginProject();
    const outputPath = path.join(projectDir, "release.tdplugin");

    process.chdir(projectDir);
    await generatePluginCommandTypesFile();
    await mkdir(path.join(projectDir, "dist"), { recursive: true });
    await writeFile(
      path.join(projectDir, "dist", "index.js"),
      "export default { activate() {} };\n",
      "utf8",
    );

    await expect(
      runCommand(createPluginToolsCommand(), {
        rawArgs: ["pack", "--output", outputPath],
      }),
    ).resolves.toEqual({ result: undefined });
    expect(existsSync(outputPath)).toBe(true);
  });

  it("builds and packages with dist", async () => {
    const projectDir = await createPluginProject();
    const outputPath = path.join(projectDir, "release.tdplugin");

    await writeFakeVite(projectDir);
    process.chdir(projectDir);

    const result = await distPluginProject({ outputPath });

    expect(result.packagePath).toBe(outputPath);
    expect(result.stages).toEqual(["generate", "check", "vite build", "check --built"]);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("wires the dist subcommand", async () => {
    const projectDir = await createPluginProject();
    const outputPath = path.join(projectDir, "release.tdplugin");

    await writeFakeVite(projectDir);
    process.chdir(projectDir);

    await expect(
      runCommand(createPluginToolsCommand(), {
        rawArgs: ["dist", "--output", outputPath],
      }),
    ).resolves.toEqual({ result: undefined });
    expect(existsSync(outputPath)).toBe(true);
  });
});

async function createPluginProject(
  options: {
    includeVitePlugin?: boolean;
    manifest?: PluginManifest;
  } = {},
): Promise<string> {
  const projectDir = createTempDir();

  await writeManifest(path.join(projectDir, "manifest.json"), options.manifest);
  await writePackageJson(path.join(projectDir, "package.json"), {
    includeVitePlugin: options.includeVitePlugin ?? true,
  });
  await mkdir(path.join(projectDir, "locales"), { recursive: true });
  await writeFile(
    path.join(projectDir, "locales", "en.json"),
    JSON.stringify({
      "plugin.name": "Test Tools",
      "commands.format.title": "Format JSON",
    }),
    "utf8",
  );

  return projectDir;
}

async function writeManifest(
  manifestPath: string,
  manifest: PluginManifest = createManifest(),
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
}

async function writePackageJson(
  packageJsonPath: string,
  options: {
    includeVitePlugin: boolean;
  },
): Promise<void> {
  const dependencies: Record<string, string> = {
    "@tooldeck/plugin-tools": "workspace:*",
    "@tooldeck/sdk-node": "workspace:*",
  };

  if (options.includeVitePlugin) {
    dependencies["@tooldeck/vite-plugin"] = "workspace:*";
  }

  await writeFile(
    packageJsonPath,
    JSON.stringify({
      name: "test-tools",
      version: "0.0.0",
      type: "module",
      scripts: {
        generate: "tooldeck-plugin generate",
        check: "tooldeck-plugin check",
        build: "tooldeck-plugin build --bundler vite",
      },
      dependencies,
    }),
    "utf8",
  );
}

async function writeFakeVite(projectDir: string): Promise<void> {
  const viteDir = path.join(projectDir, "node_modules", "vite");

  await mkdir(viteDir, { recursive: true });
  await writeFile(
    path.join(viteDir, "package.json"),
    JSON.stringify({
      name: "vite",
      version: "0.0.0",
      type: "module",
      exports: "./index.js",
    }),
    "utf8",
  );
  await writeFile(
    path.join(viteDir, "index.js"),
    [
      'import { mkdir, writeFile } from "node:fs/promises";',
      'import path from "node:path";',
      "export async function build(options = {}) {",
      "  const root = options.root ?? process.cwd();",
      '  await mkdir(path.join(root, "dist"), { recursive: true });',
      '  await writeFile(path.join(root, "dist", "index.js"), "export default { activate() {} };\\n", "utf8");',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function createManifest(): PluginManifest {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.test-tools",
    name: {
      key: "plugin.name",
      default: "Test Tools",
    },
    version: "0.0.0",
    runtime: {
      kind: "node",
      entry: "./dist/index.js",
    },
    defaultLocale: "en",
    locales: {
      en: "./locales/en.json",
    },
    contributes: {
      commands: [
        {
          id: "json.format",
          title: {
            key: "commands.format.title",
            default: "Format JSON",
          },
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
      ],
    },
  };
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-project-"));

  tempDirs.push(dir);

  return dir;
}
