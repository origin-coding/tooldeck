import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildPluginProject, checkPluginProject, PluginBuildError } from "../src";
import { createPluginProject, writeFakeVite } from "./plugin-project-fixtures";

describe("buildPluginProject", () => {
  it("runs generate, check, Vite build, and check --built", async () => {
    const projectDir = await createPluginProject();
    await writeFakeVite(projectDir);
    process.chdir(projectDir);

    const result = await buildPluginProject({ bundler: "vite" });

    expect(result.stages).toEqual(["generate", "check", "vite build", "check --built"]);
    expect(existsSync(path.join(projectDir, "src", "generated", "commands.ts"))).toBe(true);
    expect(existsSync(path.join(projectDir, "dist", "index.js"))).toBe(true);
    expect((await checkPluginProject({ built: true })).ok).toBe(true);
  });

  it("rejects unsupported bundlers before running build stages", async () => {
    const projectDir = await createPluginProject();
    process.chdir(projectDir);

    await expect(buildPluginProject({ bundler: "esbuild" })).rejects.toMatchObject({
      stage: "setup",
    } satisfies Partial<PluginBuildError>);
  });
});
