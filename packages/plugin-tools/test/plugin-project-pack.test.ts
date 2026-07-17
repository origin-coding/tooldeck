import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "citty";
import { describe, expect, it } from "vitest";

import {
  createPluginToolsCommand,
  distPluginProject,
  generatePluginCommandTypesFile,
  packPluginProject,
} from "../src";
import { createPluginProject, writeFakeVite } from "./plugin-project-fixtures";

async function prepareBuiltProject(): Promise<{ projectDir: string; outputPath: string }> {
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
  return { projectDir, outputPath };
}

describe("packPluginProject", () => {
  it("creates a .tdplugin package from built output", async () => {
    const { outputPath } = await prepareBuiltProject();

    const result = await packPluginProject({ outputPath });

    expect(result.packagePath).toBe(outputPath);
    expect(result.pluginId).toBe("dev.tooldeck.test-tools");
    expect(result.files).toContain("manifest.json");
    expect(result.files).toContain("tooldeck-package.json");
    expect(existsSync(outputPath)).toBe(true);
  });

  it("overwrites an existing output package path", async () => {
    const { outputPath } = await prepareBuiltProject();
    await writeFile(outputPath, "old package", "utf8");

    const result = await packPluginProject({ outputPath });

    expect(result.packagePath).toBe(outputPath);
    await expect(readFile(outputPath, "utf8")).resolves.not.toBe("old package");
  });

  it("wires the pack subcommand", async () => {
    const { outputPath } = await prepareBuiltProject();

    await expect(
      runCommand(createPluginToolsCommand(), { rawArgs: ["pack", "--output", outputPath] }),
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
      runCommand(createPluginToolsCommand(), { rawArgs: ["dist", "--output", outputPath] }),
    ).resolves.toEqual({ result: undefined });
    expect(existsSync(outputPath)).toBe(true);
  });
});
