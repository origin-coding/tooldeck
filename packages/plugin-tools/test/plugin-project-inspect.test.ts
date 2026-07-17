import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "citty";
import { describe, expect, it } from "vitest";

import {
  createPluginToolsCommand,
  formatPluginInspection,
  generatePluginCommandTypesFile,
  inspectPluginProject,
} from "../src";
import { createPluginProject } from "./plugin-project-fixtures";

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

    const output = formatPluginInspection(await inspectPluginProject());

    for (const section of [
      "Summary",
      "Manifest",
      "Commands",
      "Locales",
      "Packages",
      "Diagnostics",
    ]) {
      expect(output).toContain(`${section}\n`);
    }
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

    await expect(runCommand(createPluginToolsCommand(), { rawArgs: ["inspect"] })).resolves.toEqual(
      { result: undefined },
    );
  });

  it("sets an exit code when inspect finds error diagnostics", async () => {
    const projectDir = await createPluginProject();
    process.chdir(projectDir);

    await expect(runCommand(createPluginToolsCommand(), { rawArgs: ["inspect"] })).resolves.toEqual(
      { result: undefined },
    );
    expect(process.exitCode).toBe(1);
  });
});
