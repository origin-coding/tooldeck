import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const artifactChecks = [
  { label: "runtime-node", paths: ["internal/runtime-node/dist/index.js.map"], expected: 0 },
  {
    label: "application-node",
    paths: ["internal/application-node/dist/index.js.map"],
    expected: 0,
  },
  { label: "CLI", paths: ["apps/cli/dist/index.js.map"], expected: 1 },
  { label: "Desktop main", paths: ["apps/desktop/.vite/build/main.js.map"], expected: 1 },
  {
    label: "Desktop preload",
    paths: ["apps/desktop/.vite/build/preload.cjs.map"],
    expected: 0,
  },
  { label: "Desktop renderer", paths: ["apps/desktop/.vite/renderer"], expected: 0 },
];

const failures = [];

for (const check of artifactChecks) {
  const mapFiles = check.paths.flatMap(resolveSourceMaps);
  const implementationSources = mapFiles.flatMap(readAjvImplementationSources);
  const versions = new Set(implementationSources.map(readPnpmAjvVersion));

  if (implementationSources.length !== check.expected) {
    failures.push(
      `${check.label}: expected ${check.expected} Ajv implementation source${
        check.expected === 1 ? "" : "s"
      }, found ${implementationSources.length}`,
    );
  }

  const unexpectedVersions = [...versions].filter(
    (version) => version === undefined || !version.startsWith("8."),
  );

  if (unexpectedVersions.length > 0) {
    failures.push(
      `${check.label}: expected only Ajv 8 sources, found ${unexpectedVersions
        .map((version) => version ?? "an unversioned source")
        .join(", ")}`,
    );
  }

  console.log(
    `${check.label}: ${implementationSources.length} Ajv implementation${
      implementationSources.length === 1 ? "" : "s"
    }${versions.size > 0 ? ` (${[...versions].join(", ")})` : ""}`,
  );
}

if (failures.length > 0) {
  console.error(`Ajv artifact checks failed:\n\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("Ajv artifact checks passed.");

function resolveSourceMaps(relativePath) {
  const targetPath = path.resolve(workspaceRoot, relativePath);

  try {
    if (statSync(targetPath).isFile()) {
      return [targetPath];
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing build artifact: ${relativePath}`);
    }

    throw error;
  }

  return collectSourceMaps(targetPath);
}

function collectSourceMaps(directoryPath) {
  return readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectSourceMaps(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".map") ? [entryPath] : [];
    });
}

function readAjvImplementationSources(mapPath) {
  const sourceMap = JSON.parse(readFileSync(mapPath, "utf8"));

  if (!Array.isArray(sourceMap.sources)) {
    throw new Error(`Invalid source map without sources: ${path.relative(workspaceRoot, mapPath)}`);
  }

  return sourceMap.sources
    .map((source) => source.replaceAll("\\", "/"))
    .filter((source) => source.endsWith("/node_modules/ajv/dist/ajv.js"));
}

function readPnpmAjvVersion(source) {
  return source.match(/\/\.pnpm\/ajv@([^/]+)\/node_modules\/ajv\//)?.[1];
}
