import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("../", import.meta.url));

const rendererAndPreload = ["src/renderer", "src/preload"];
const allowedDesktopApiMethods = [
  "listCommands",
  "listPlugins",
  "listPluginDataResidues",
  "listPreferences",
  "getPreference",
  "setPreference",
  "setPluginEnabled",
  "installDroppedPluginPackage",
  "uninstallPlugin",
  "purgePluginData",
  "rescanPlugins",
  "runCommand",
  "listCommandRuns",
];

const checks = [
  {
    name: "renderer/preload must not import storage or host-node",
    pattern: String.raw`@tooldeck/(storage|host-node)`,
    paths: rendererAndPreload,
    expect: "no-match",
  },
  {
    name: "renderer/preload must not access SQLite or storage repositories",
    pattern: String.raw`node:sqlite|drizzle-orm/node-sqlite|openTooldeckDatabase|CommandRunRepository|PluginRepository|PluginKvRepository`,
    paths: rendererAndPreload,
    expect: "no-match",
  },
  {
    name: "renderer/preload must not import local plugin source",
    pattern: String.raw`from\s+["'][^"']*(\.\./|/)?plugins/(json-tools|hello-world)|import\(["'][^"']*(\.\./|/)?plugins/(json-tools|hello-world)`,
    paths: rendererAndPreload,
    expect: "no-match",
  },
  {
    name: "renderer must not access Electron file path or IPC APIs",
    pattern: String.raw`from\s+["']electron["']|webUtils|getPathForFile|ipcRenderer`,
    paths: ["src/renderer"],
    expect: "no-match",
  },
  {
    name: "main service composes runtime-node, host-node, and storage",
    pattern: String.raw`@tooldeck/(runtime-node|host-node|storage)`,
    paths: ["src/main"],
    expect: "match",
  },
];

const failures = [];

for (const check of checks) {
  const matches = findMatches(check.pattern, check.paths);
  const matched = matches.length > 0;

  if (check.expect === "no-match" && matched) {
    failures.push(`${check.name}\n${matches.map(formatMatch).join("\n")}`);
    continue;
  }

  if (check.expect === "match" && !matched) {
    failures.push(`${check.name}\nExpected at least one match for: ${check.pattern}`);
  }
}

assertRequiredMatch({
  name: "preload exposes the Tooldeck API through contextBridge",
  pattern: String.raw`contextBridge\.exposeInMainWorld\("tooldeck", api\)`,
  paths: ["src/preload"],
});
assertOnlyAllowedMethods({
  name: "preload only defines the V1 Desktop API surface",
  pattern: String.raw`^  ([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/preload/index.ts"],
  allowed: allowedDesktopApiMethods,
});
assertOnlyAllowedMethods({
  name: "renderer only calls the V1 Desktop API surface",
  pattern: String.raw`window\.tooldeck\.([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/renderer"],
  allowed: allowedDesktopApiMethods,
  requireAll: false,
});

if (failures.length > 0) {
  console.error(`Desktop boundary checks failed:\n\n${failures.join("\n\n")}`);
  process.exit(1);
}

console.log("Desktop boundary checks passed.");

function assertRequiredMatch({ name, pattern, paths }) {
  const matches = findMatches(pattern, paths);

  if (matches.length === 0) {
    failures.push(`${name}\nExpected at least one match for: ${pattern}`);
  }
}

function assertOnlyAllowedMethods({ name, pattern, paths, allowed, requireAll = true }) {
  const matches = findMatches(pattern, paths);
  const expression = new RegExp(pattern);

  if (matches.length === 0) {
    failures.push(`${name}\nExpected at least one API method match for: ${pattern}`);
    return;
  }

  const found = new Set();

  for (const result of matches) {
    const match = result.text.match(expression);

    if (match) {
      found.add(match[1]);
    }
  }

  const extra = [...found].filter((method) => !allowed.includes(method));
  const missing = requireAll ? allowed.filter((method) => !found.has(method)) : [];

  if (extra.length > 0 || missing.length > 0) {
    failures.push(
      `${name}\nAllowed: ${allowed.join(", ")}\nFound: ${[...found].join(", ") || "(none)"}`,
    );
  }
}

function findMatches(pattern, searchPaths) {
  const expression = new RegExp(pattern);
  const matches = [];

  for (const filePath of resolveFiles(searchPaths)) {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const [index, text] of lines.entries()) {
      if (expression.test(text)) {
        matches.push({ filePath, lineNumber: index + 1, text });
      }
    }
  }

  return matches;
}

function resolveFiles(searchPaths) {
  return searchPaths.flatMap((searchPath) => collectFiles(path.resolve(desktopRoot, searchPath)));
}

function collectFiles(targetPath) {
  if (statSync(targetPath).isFile()) {
    return [targetPath];
  }

  return readdirSync(targetPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return entry.isFile() ? [entryPath] : [];
    });
}

function formatMatch(match) {
  const relativePath = path.relative(desktopRoot, match.filePath).replaceAll(path.sep, "/");
  return `${relativePath}:${match.lineNumber}:${match.text}`;
}
