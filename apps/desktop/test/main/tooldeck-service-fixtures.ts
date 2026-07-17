import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { afterEach } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function createDatabasePath(): string {
  return path.join(createTempDir(), "tooldeck.sqlite");
}

export function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-desktop-"));

  tempDirs.push(dir);

  return dir;
}

export function createPluginManifest(id: string, name: string, version: string) {
  return {
    schemaVersion: "1.0" as const,
    id,
    name,
    version,
    runtime: {
      kind: "node" as const,
      entry: "./dist/index.js",
    },
  };
}

export async function createEchoPlugin(options: {
  commandId: string;
  pluginId: string;
  pluginRoot: string;
  responseText: string;
}): Promise<void> {
  mkdirSync(options.pluginRoot, { recursive: true });
  await writeFile(
    path.join(options.pluginRoot, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "External Echo",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./index.mjs",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "External Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(options.pluginRoot, "index.mjs"),
    `
      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: ${JSON.stringify(options.responseText)} }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
}

export async function createInstallablePluginPackage(options: {
  activationMarkerPath: string;
  commandId: string;
  pluginId: string;
  rootDir: string;
}): Promise<string> {
  const projectDir = path.join(options.rootDir, "installable-plugin-project");
  const runtimeDir = path.join(projectDir, "dist");
  const packagePath = path.join(options.rootDir, `${options.pluginId}-1.0.0.tdplugin`);

  mkdirSync(runtimeDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "Desktop Installed Plugin",
      version: "1.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "Installed Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(runtimeDir, "index.js"),
    `
      import { writeFile } from "node:fs/promises";

      await writeFile(${JSON.stringify(options.activationMarkerPath)}, "activated", "utf8");

      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: "installed ok" }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
  await packTooldeckPlugin({
    projectDir,
    outputPath: packagePath,
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
  });

  return packagePath;
}
