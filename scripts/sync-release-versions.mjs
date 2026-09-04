import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceGroups = ["apps", "internal", "packages", "plugins", "tests"];

export function syncReleaseVersions(root, { check = false } = {}) {
  const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
  const version = readJson(path.join(root, "packages/protocol/package.json")).version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Tooldeck releases require a stable major.minor.patch version.");
  }

  const packages = workspaceGroups.flatMap((group) => {
    const directory = path.join(root, group);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name, "package.json"))
      .filter((file) => existsSync(file));
  });

  // Changesets owns package versions. Fail before writing if its fixed group drifted.
  const mismatches = packages.flatMap((file) => {
    const metadata = readJson(file);
    return metadata.version === version
      ? []
      : [`${path.relative(root, file)}: ${metadata.version} (expected ${version})`];
  });
  if (mismatches.length > 0) {
    throw new Error(
      `Workspace versions differ. Run pnpm version-packages.\n${mismatches.join("\n")}`,
    );
  }

  const metadataFiles = [
    path.join(root, "package.json"),
    ...packages
      .filter((file) => path.dirname(path.dirname(file)) === path.join(root, "plugins"))
      .map((file) => path.join(path.dirname(file), "manifest.json")),
  ];
  // Read every manifest before writing anything, including on malformed/missing input.
  const updates = metadataFiles
    .map((file) => ({ file, metadata: readJson(file) }))
    .filter(({ metadata }) => metadata.version !== version);
  if (check && updates.length > 0) {
    throw new Error(
      `Release metadata differs from ${version}. Run node scripts/sync-release-versions.mjs.\n${updates
        .map(({ file }) => path.relative(root, file))
        .join("\n")}`,
    );
  }
  for (const { file, metadata } of updates) {
    writeFileSync(file, `${JSON.stringify({ ...metadata, version }, null, 2)}\n`);
  }
  return { version, packageCount: packages.length, updatedFiles: updates.map(({ file }) => file) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = syncReleaseVersions(root, { check: process.argv.includes("--check") });
  console.log(
    `Tooldeck ${result.version}: ${result.packageCount} workspace packages share one version.`,
  );
}
