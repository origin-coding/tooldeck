import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";
import { afterEach } from "vitest";

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

export async function createPluginProject(
  options: { includeVitePlugin?: boolean; manifest?: PluginManifest } = {},
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

export async function writeFakeVite(projectDir: string): Promise<void> {
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

export function createManifest(): PluginManifest {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.test-tools",
    name: { key: "plugin.name", default: "Test Tools" },
    version: "0.0.0",
    runtime: { kind: "node", entry: "./dist/index.js" },
    defaultLocale: "en",
    locales: { en: "./locales/en.json" },
    contributes: {
      commands: [
        {
          id: "json.format",
          title: { key: "commands.format.title", default: "Format JSON" },
          inputSchema: {
            type: "object",
            required: ["text"],
            additionalProperties: false,
            properties: { text: { type: "string" } },
          },
        },
      ],
    },
  };
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
  options: { includeVitePlugin: boolean },
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

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-project-"));
  tempDirs.push(dir);
  return dir;
}
