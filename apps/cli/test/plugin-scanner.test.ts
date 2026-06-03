import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ManifestIndex } from "@tooldeck/core";
import { describe, expect, it } from "vitest";

import { scanPluginDirectory } from "../src/plugin-scanner";

describe("scanPluginDirectory", () => {
  it("indexes plugin manifests from child directories", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");
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

  it("throws a clear error when the plugin directory does not exist", async () => {
    const pluginsRoot = path.join(".tmp", "cli-tests", "missing", "plugins");

    await expect(
      scanPluginDirectory({
        pluginsRoot,
        manifestIndex: new ManifestIndex(),
      }),
    ).rejects.toThrow(`Plugin directory does not exist: ${pluginsRoot}`);
  });

  it("throws a clear error for malformed plugin manifests", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");
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
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");
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
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");
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
