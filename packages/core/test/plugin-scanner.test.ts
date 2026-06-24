import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ManifestIndex, scanPluginDirectory, scanPluginSources } from "../src";

describe("scanPluginDirectory", () => {
  it("indexes plugin manifests from child directories", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "core-tests", task.id, "plugins");
    const pluginRoot = path.join(pluginsRoot, "hello-world");
    const manifestPath = path.join(pluginRoot, "manifest.json");
    const manifestIndex = new ManifestIndex();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.hello-world",
        name: "Hello World",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./dist/index.js",
        },
        contributes: {
          commands: [
            {
              id: "hello.world",
              title: "Hello World",
            },
          ],
        },
      }),
      "utf8",
    );

    await mkdir(path.join(pluginsRoot, "empty-plugin"), { recursive: true });

    await expect(scanPluginDirectory({ pluginsRoot, manifestIndex })).resolves.toEqual({
      pluginCount: 1,
      commandCount: 1,
    });

    expect(manifestIndex.hasPlugin("dev.tooldeck.hello-world")).toBe(true);
    expect(manifestIndex.getCommandOwner("hello.world")).toBe("dev.tooldeck.hello-world");
    expect(manifestIndex.getCommand("hello.world")).toMatchObject({
      manifestPath,
      entryPath: path.resolve(pluginRoot, "dist/index.js"),
    });
  });

  it("indexes a plugin project root when it contains a manifest", async ({ task }) => {
    const pluginRoot = path.join(".tmp", "core-tests", task.id, "project-plugin");
    const manifestPath = path.join(pluginRoot, "manifest.json");
    const manifestIndex = new ManifestIndex();

    await mkdir(pluginRoot, { recursive: true });
    await writePluginManifest(manifestPath, {
      id: "dev.tooldeck.project-plugin",
      name: "Project Plugin",
      commandId: "project.run",
      commandTitle: "Run Project",
    });

    await expect(scanPluginDirectory({ pluginsRoot: pluginRoot, manifestIndex })).resolves.toEqual({
      pluginCount: 1,
      commandCount: 1,
    });

    expect(manifestIndex.hasPlugin("dev.tooldeck.project-plugin")).toBe(true);
    expect(manifestIndex.getCommandOwner("project.run")).toBe("dev.tooldeck.project-plugin");
    expect(manifestIndex.getCommand("project.run")).toMatchObject({
      manifestPath,
      entryPath: path.resolve(pluginRoot, "dist/index.js"),
    });
  });

  it("merges builtin and external plugin scan sources", async ({ task }) => {
    const builtinRoot = path.join(".tmp", "core-tests", task.id, "builtin");
    const externalRoot = path.join(".tmp", "core-tests", task.id, "external-plugin");
    const manifestIndex = new ManifestIndex();

    await mkdir(path.join(builtinRoot, "builtin-plugin"), { recursive: true });
    await writePluginManifest(path.join(builtinRoot, "builtin-plugin", "manifest.json"), {
      id: "dev.tooldeck.builtin-plugin",
      name: "Builtin Plugin",
      commandId: "builtin.run",
      commandTitle: "Run Builtin",
    });
    await mkdir(externalRoot, { recursive: true });
    await writePluginManifest(path.join(externalRoot, "manifest.json"), {
      id: "dev.tooldeck.external-plugin",
      name: "External Plugin",
      commandId: "external.run",
      commandTitle: "Run External",
    });

    await expect(
      scanPluginSources({
        sources: [
          {
            kind: "builtin",
            path: builtinRoot,
          },
          {
            kind: "external",
            path: externalRoot,
          },
        ],
        manifestIndex,
      }),
    ).resolves.toEqual({
      pluginCount: 2,
      commandCount: 2,
    });

    expect(manifestIndex.getCommandOwner("builtin.run")).toBe("dev.tooldeck.builtin-plugin");
    expect(manifestIndex.getCommandOwner("external.run")).toBe("dev.tooldeck.external-plugin");
  });

  it("throws a clear error when an external plugin directory does not exist", async () => {
    const pluginDir = path.join(".tmp", "core-tests", "missing", "external");

    await expect(
      scanPluginSources({
        sources: [
          {
            kind: "external",
            path: pluginDir,
          },
        ],
        manifestIndex: new ManifestIndex(),
      }),
    ).rejects.toThrow(`External plugin directory does not exist: ${pluginDir}`);
  });

  it("throws a clear error when the plugin directory does not exist", async () => {
    const pluginsRoot = path.join(".tmp", "core-tests", "missing", "plugins");

    await expect(
      scanPluginDirectory({
        pluginsRoot,
        manifestIndex: new ManifestIndex(),
      }),
    ).rejects.toThrow(`Plugin directory does not exist: ${pluginsRoot}`);
  });

  it("throws a clear error for malformed plugin manifests", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "core-tests", task.id, "plugins");
    const pluginRoot = path.join(pluginsRoot, "bad-plugin");
    const manifestPath = path.join(pluginRoot, "manifest.json");

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(manifestPath, "{", "utf8");

    await expect(
      scanPluginDirectory({
        pluginsRoot,
        manifestIndex: new ManifestIndex(),
      }),
    ).rejects.toThrow(`Plugin manifest is not valid JSON: ${manifestPath}`);
  });

  it("throws a clear error for invalid plugin manifests", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "core-tests", task.id, "plugins");
    const pluginRoot = path.join(pluginsRoot, "bad-plugin");
    const manifestPath = path.join(pluginRoot, "manifest.json");

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: "1.0",
        id: "Invalid",
        name: "Invalid",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./dist/index.js",
        },
      }),
      "utf8",
    );

    await expect(
      scanPluginDirectory({
        pluginsRoot,
        manifestIndex: new ManifestIndex(),
      }),
    ).rejects.toThrow("Invalid plugin manifest");
  });

  it("indexes valid manifests without checking that runtime entries exist", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "core-tests", task.id, "plugins");
    const pluginRoot = path.join(pluginsRoot, "missing-entry");
    const manifestPath = path.join(pluginRoot, "manifest.json");
    const manifestIndex = new ManifestIndex();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.missing-entry",
        name: "Missing Entry",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./dist/missing.js",
        },
        contributes: {
          commands: [
            {
              id: "missing.entry",
              title: "Missing Entry",
            },
          ],
        },
      }),
      "utf8",
    );

    await expect(scanPluginDirectory({ pluginsRoot, manifestIndex })).resolves.toEqual({
      pluginCount: 1,
      commandCount: 1,
    });
    expect(manifestIndex.getCommand("missing.entry")).toMatchObject({
      entryPath: path.resolve(pluginRoot, "dist/missing.js"),
    });
  });
});

async function writePluginManifest(
  manifestPath: string,
  options: {
    id: string;
    name: string;
    commandId: string;
    commandTitle: string;
  },
): Promise<void> {
  await writeFile(
    manifestPath,
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.id,
      name: options.name,
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: options.commandTitle,
          },
        ],
      },
    }),
    "utf8",
  );
}
