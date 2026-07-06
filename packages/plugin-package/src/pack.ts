import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_PACKAGE_INCLUDE_DIRS,
  TOOLDECK_PACKAGE_MANIFEST_PATH,
  TOOLDECK_PLUGIN_MANIFEST_PATH,
} from "./constants.js";
import { computePackageDigest } from "./digest.js";
import { FflateZipAdapter, textToBytes } from "./fflate-zip-adapter.js";
import { parsePluginManifestText } from "./manifest.js";
import { createTooldeckPackageManifest } from "./package-manifest.js";
import { readTooldeckPackage } from "./package-reader.js";
import { assertSafePackagePath, dedupeAndSortPackagePaths } from "./paths.js";
import type {
  PackTooldeckPluginOptions,
  PackTooldeckPluginResult,
  TooldeckPackageFile,
  TooldeckPackagePluginManifest,
} from "./types.js";
import type { ZipAdapter, ZipWriteEntry } from "./zip-adapter.js";

const defaultZipAdapter = new FflateZipAdapter();

export async function packTooldeckPlugin(
  options: PackTooldeckPluginOptions,
  zipAdapter: ZipAdapter = defaultZipAdapter,
): Promise<PackTooldeckPluginResult> {
  const manifestFile = path.resolve(
    options.manifestPath ??
      path.join(options.projectDir ?? process.cwd(), TOOLDECK_PLUGIN_MANIFEST_PATH),
  );
  const projectDir = path.resolve(options.projectDir ?? path.dirname(manifestFile));
  const manifestText = await readFile(manifestFile, "utf8");
  const pluginManifest = parsePluginManifestText(manifestText, TOOLDECK_PLUGIN_MANIFEST_PATH);
  const outputPath =
    options.outputPath ??
    path.join(projectDir, `${pluginManifest.id}-${pluginManifest.version}.tdplugin`);

  const files = await collectTooldeckPackageFiles(projectDir, pluginManifest, manifestText);
  const packageManifest = createTooldeckPackageManifest({
    createdAt: options.createdAt,
    files: files.map((file) => file.path),
  });
  const entries: ZipWriteEntry[] = [
    ...files,
    {
      path: TOOLDECK_PACKAGE_MANIFEST_PATH,
      data: textToBytes(`${JSON.stringify(packageManifest, null, 2)}\n`),
    },
  ];

  await zipAdapter.writeArchive(outputPath, entries);
  const summary = await readTooldeckPackage(
    {
      packagePath: outputPath,
      limits: options.limits,
    },
    zipAdapter,
  );

  return {
    packagePath: outputPath,
    packageManifest: summary.packageManifest,
    pluginManifest,
    files: summary.files,
    packageDigest: await computePackageDigest(outputPath),
    packageSizeBytes: summary.packageSizeBytes,
  };
}

export async function collectTooldeckPackageFiles(
  projectDir: string,
  pluginManifest: TooldeckPackagePluginManifest,
  manifestText?: string,
): Promise<TooldeckPackageFile[]> {
  const packagePaths = dedupeAndSortPackagePaths([
    TOOLDECK_PLUGIN_MANIFEST_PATH,
    pluginManifest.runtime.entry,
    ...Object.values(pluginManifest.locales ?? {}).filter(
      (localePath) => typeof localePath === "string",
    ),
    ...(await collectDefaultDirectoryPackagePaths(projectDir)),
  ]);

  const files: TooldeckPackageFile[] = [];

  for (const packagePath of packagePaths) {
    if (packagePath === TOOLDECK_PACKAGE_MANIFEST_PATH) {
      continue;
    }

    if (packagePath === TOOLDECK_PLUGIN_MANIFEST_PATH && manifestText !== undefined) {
      files.push({
        path: packagePath,
        data: textToBytes(manifestText.endsWith("\n") ? manifestText : `${manifestText}\n`),
      });
    } else {
      const absolutePath = resolveProjectPackagePath(projectDir, packagePath);
      files.push({
        path: packagePath,
        data: await readFile(absolutePath),
      });
    }
  }

  return files;
}

async function collectDefaultDirectoryPackagePaths(projectDir: string): Promise<string[]> {
  const paths: string[] = [];

  for (const directory of DEFAULT_PACKAGE_INCLUDE_DIRS) {
    const absoluteDirectory = path.join(projectDir, directory);

    if (!(await isDirectory(absoluteDirectory))) {
      continue;
    }

    paths.push(...(await collectRegularFiles(projectDir, absoluteDirectory)));
  }

  return paths;
}

async function collectRegularFiles(projectDir: string, directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectRegularFiles(projectDir, absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(toPackagePath(projectDir, absolutePath));
  }

  return files;
}

function resolveProjectPackagePath(projectDir: string, packagePath: string): string {
  const normalizedPath = assertSafePackagePath(packagePath);
  const absolutePath = path.resolve(projectDir, ...normalizedPath.split("/"));
  const relative = path.relative(projectDir, absolutePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Package path escapes the project directory: ${packagePath}`);
  }

  return absolutePath;
}

function toPackagePath(projectDir: string, absolutePath: string): string {
  return assertSafePackagePath(path.relative(projectDir, absolutePath).replaceAll(path.sep, "/"));
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}
