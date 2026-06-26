import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { tooldeckPlugin } from "../src";
import type { TooldeckVitePluginOptions } from "../src";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("tooldeckPlugin", () => {
  it("exposes the Tooldeck Vite plugin", () => {
    expect(tooldeckPlugin().name).toBe("tooldeck-plugin");
  });

  it("builds the default Node ESM plugin entry without activating the plugin", async () => {
    const projectDir = createTempDir();
    const activationMarker = path.join(projectDir, "activated.txt");

    await writePluginProject(projectDir, {
      source: [
        'import { writeFileSync } from "node:fs";',
        "export default {",
        `  activate() { writeFileSync(${JSON.stringify(activationMarker)}, "activated"); },`,
        "};",
        "",
      ].join("\n"),
    });

    await runViteBuild(projectDir);

    const outputPath = path.join(projectDir, "dist", "index.js");
    const output = await readFile(outputPath, "utf8");
    const moduleExports = (await import(
      `${pathToFileURL(outputPath).href}?tooldeck-test=${Date.now()}`
    )) as { default?: { activate?: unknown } };

    expect(output).toContain("node:fs");
    expect(typeof moduleExports.default?.activate).toBe("function");
    expect(existsSync(activationMarker)).toBe(false);
  });

  it("supports custom entry and output paths when manifest.runtime.entry matches", async () => {
    const projectDir = createTempDir();

    await writePluginProject(projectDir, {
      entryPath: path.join("source", "main.ts"),
      manifestEntry: "./build/plugin.mjs",
      source: "export default { activate() {} };\n",
    });

    await runViteBuild(projectDir, {
      entry: "source/main.ts",
      outDir: "build",
      outputFile: "plugin.mjs",
    });

    expect(existsSync(path.join(projectDir, "build", "plugin.mjs"))).toBe(true);
  });

  it("fails when the manifest file is missing", async () => {
    const projectDir = createTempDir();

    await writeSourceFile(projectDir, "src/index.ts", "export default { activate() {} };\n");

    await expect(runViteBuild(projectDir)).rejects.toThrow(
      "Tooldeck plugin manifest could not be read",
    );
  });

  it("fails when manifest.runtime.kind is not node", async () => {
    const projectDir = createTempDir();

    await writePluginProject(projectDir, {
      runtimeKind: "wasm",
    });

    await expect(runViteBuild(projectDir)).rejects.toThrow(
      'Tooldeck plugin manifest runtime.kind must be "node"',
    );
  });

  it("fails when manifest.runtime.entry does not match the configured output", async () => {
    const projectDir = createTempDir();

    await writePluginProject(projectDir, {
      manifestEntry: "./dist/plugin.js",
    });

    await expect(runViteBuild(projectDir)).rejects.toThrow(
      'Tooldeck plugin manifest runtime.entry must be "./dist/index.js"',
    );
  });
});

async function runViteBuild(
  projectDir: string,
  options: TooldeckVitePluginOptions = {},
): Promise<void> {
  await build({
    root: projectDir,
    configFile: false,
    clearScreen: false,
    logLevel: "silent",
    plugins: [tooldeckPlugin(options)],
  });
}

async function writePluginProject(
  projectDir: string,
  options: {
    entryPath?: string;
    manifestEntry?: string;
    runtimeKind?: string;
    source?: string;
  } = {},
): Promise<void> {
  await writeManifest(projectDir, {
    runtimeKind: options.runtimeKind ?? "node",
    runtimeEntry: options.manifestEntry ?? "./dist/index.js",
  });
  await writeSourceFile(
    projectDir,
    options.entryPath ?? path.join("src", "index.ts"),
    options.source ?? "export default { activate() {} };\n",
  );
}

async function writeManifest(
  projectDir: string,
  options: {
    runtimeKind: string;
    runtimeEntry: string;
  },
): Promise<void> {
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: "dev.tooldeck.vite-fixture",
      name: "Vite Fixture",
      version: "0.0.0",
      runtime: {
        kind: options.runtimeKind,
        entry: options.runtimeEntry,
      },
    }),
    "utf8",
  );
}

async function writeSourceFile(
  projectDir: string,
  relativePath: string,
  source: string,
): Promise<void> {
  const sourcePath = path.join(projectDir, relativePath);

  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, source, "utf8");
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-vite-plugin-"));

  tempDirs.push(dir);

  return dir;
}
