import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkPluginProject } from "@tooldeck/plugin-tools";
import { runCommand } from "citty";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCreatePluginCommand,
  createPluginProject,
  createTemplateData,
  parseCreatePluginArgs,
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

describe("parseCreatePluginArgs", () => {
  it("accepts the plugin name as the first positional argument", () => {
    expect(parseCreatePluginArgs(["my-plugin"])).toMatchObject({
      name: "my-plugin",
    });
  });

  it("accepts the plugin name as --name", () => {
    expect(parseCreatePluginArgs(["--name", "my-plugin"])).toMatchObject({
      name: "my-plugin",
    });
    expect(parseCreatePluginArgs(["--name=my-plugin"])).toMatchObject({
      name: "my-plugin",
    });
  });

  it("rejects conflicting positional and named plugin names", () => {
    expect(() => parseCreatePluginArgs(["one-plugin", "--name", "two-plugin"])).toThrow(
      "Plugin name was provided twice",
    );
  });
});

describe("createTemplateData", () => {
  it("derives Tooldeck ids and display names from the project name", () => {
    expect(createTemplateData("my-plugin")).toMatchObject({
      packageName: "my-plugin",
      pluginId: "dev.tooldeck.my-plugin",
      pluginName: "My Plugin",
      commandId: "my-plugin.echo",
      commandIdKey: "myPluginEcho",
      commandInputTypeName: "MyPluginEchoInput",
    });
  });

  it("validates explicit plugin and command ids", () => {
    expect(() => createTemplateData("my-plugin", { pluginId: "Bad.ID" })).toThrow(
      "Plugin id must use lowercase dot-separated segments",
    );
    expect(() => createTemplateData("my-plugin", { commandId: "echo" })).toThrow(
      "Command id must use lowercase dot-separated segments",
    );
  });
});

describe("createPluginProject", () => {
  it("renders the local Node Vite plugin template", async () => {
    const cwd = createTempDir();
    const result = await createPluginProject({
      cwd,
      name: "my-plugin",
      pluginName: "My Plugin",
    });

    expect(result.files).toContain("package.json");
    expect(result.files).toContain(path.join("src", "index.ts"));
    expect(existsSync(path.join(result.projectDir, "manifest.json"))).toBe(true);

    const packageJson = JSON.parse(
      readFileSync(path.join(result.projectDir, "package.json"), "utf8"),
    ) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const manifest = JSON.parse(
      readFileSync(path.join(result.projectDir, "manifest.json"), "utf8"),
    ) as {
      id: string;
      contributes: {
        commands: Array<{ id: string }>;
      };
    };
    const source = readFileSync(path.join(result.projectDir, "src", "index.ts"), "utf8");

    expect(packageJson).toMatchObject({
      name: "my-plugin",
      scripts: {
        generate: "tooldeck-plugin generate",
        check: "tooldeck-plugin check",
        build: "tooldeck-plugin build --bundler vite",
        typecheck: "tsc --noEmit",
        test: "vitest run",
        inspect: "tooldeck-plugin inspect",
      },
    });
    expect(packageJson.dependencies["@tooldeck/sdk-node"]).toBe("^1.1.0");
    expect(packageJson.devDependencies["@tooldeck/plugin-tools"]).toBe("^1.1.0");
    expect(packageJson.devDependencies["@tooldeck/vite-plugin"]).toBe("^1.1.0");
    expect(manifest.id).toBe("dev.tooldeck.my-plugin");
    expect(manifest.contributes.commands[0]?.id).toBe("my-plugin.echo");
    expect(source).toContain("plugin.command(commandIds.myPluginEcho");
  });

  it("generates a project that passes plugin project checks", async () => {
    const cwd = createTempDir();
    const result = await createPluginProject({
      cwd,
      name: "my-plugin",
    });

    process.chdir(result.projectDir);

    const checkResult = await checkPluginProject();

    expect(checkResult.ok).toBe(true);
    expect(checkResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
      [],
    );
  });

  it("refuses to write into a non-empty target directory", async () => {
    const cwd = createTempDir();
    const projectDir = path.join(cwd, "my-plugin");

    mkdirSync(projectDir);
    writeFileSync(path.join(projectDir, "existing.txt"), "existing", "utf8");

    await expect(createPluginProject({ cwd, name: "my-plugin" })).rejects.toThrow(
      "Target directory is not empty",
    );
  });
});

describe("create-tooldeck-plugin command", () => {
  it("creates a project from the positional plugin name", async () => {
    const cwd = createTempDir();

    process.chdir(cwd);

    await expect(
      runCommand(createCreatePluginCommand(), {
        rawArgs: ["my-plugin", "--yes", "--no-install"],
      }),
    ).resolves.toEqual({ result: undefined });

    expect(existsSync(path.join(cwd, "my-plugin", "package.json"))).toBe(true);
  });

  it("creates a project from --name", async () => {
    const cwd = createTempDir();

    process.chdir(cwd);

    await expect(
      runCommand(createCreatePluginCommand(), {
        rawArgs: ["--name", "my-plugin", "--yes", "--no-install"],
      }),
    ).resolves.toEqual({ result: undefined });

    expect(existsSync(path.join(cwd, "my-plugin", "manifest.json"))).toBe(true);
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-create-plugin-"));

  tempDirs.push(dir);

  return dir;
}
