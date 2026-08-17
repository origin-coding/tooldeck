import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("../", import.meta.url));

const rendererAndPreload = ["src/renderer", "src/preload"];
const allowedRendererApiMethods = [
  "commands.list",
  "commands.run",
  "plugins.list",
  "plugins.listDataResidues",
  "plugins.setEnabled",
  "plugins.installDroppedPackage",
  "plugins.uninstall",
  "plugins.purgeData",
  "plugins.rescan",
  "preferences.list",
  "preferences.get",
  "preferences.set",
  "history.listRuns",
];

const checks = [
  {
    name: "CLI, Desktop renderer, and Desktop preload must not import Effect",
    pattern: String.raw`(?:from\s+["']effect(?:/[^"']*)?["']|import\(["']effect(?:/[^"']*)?["']\))`,
    paths: ["src/renderer", "src/preload", "../cli/src"],
    expect: "no-match",
  },
  {
    name: "renderer/preload must not import internal application or runtime packages",
    pattern: String.raw`@tooldeck/(application-node|runtime-node|storage|plugin-management-node)`,
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
    name: "main must not compose runtime, storage, or legacy application packages",
    pattern: String.raw`@tooldeck/(runtime-node|storage|preferences|plugin-management-node|shared)`,
    paths: ["src/main"],
    expect: "no-match",
  },
  {
    name: "main consumes the application-node facade",
    pattern: String.raw`@tooldeck/application-node`,
    paths: ["src/main"],
    expect: "match",
  },
];

const failures = [];

assertMatchesOnlyInFiles({
  name: "Desktop main may import Effect only in its request codec boundary",
  pattern: String.raw`(?:from\s+["']effect(?:/[^"']*)?["']|import\(["']effect(?:/[^"']*)?["']\))`,
  paths: ["src/main"],
  allowedFiles: ["src/main/ipc/codecs/requests.ts"],
});
assertOnlyAllowedNamedImports({
  name: "Desktop request codecs may use only the approved synchronous Effect symbols",
  filePath: "src/main/ipc/codecs/requests.ts",
  moduleName: "effect",
  allowedSymbols: ["Either", "ParseResult", "Schema"],
});

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
  pattern: String.raw`contextBridge\.exposeInMainWorld\("tooldeck", desktopApi\)`,
  paths: ["src/preload"],
});
assertOnlyAllowedMethods({
  name: "preload commands domain only defines its contract",
  pattern: String.raw`^  ([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/preload/api/commands.ts"],
  allowed: ["list", "run"],
});
assertOnlyAllowedMethods({
  name: "preload plugins domain only defines its contract",
  pattern: String.raw`^  ([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/preload/api/plugins.ts"],
  allowed: [
    "list",
    "listDataResidues",
    "setEnabled",
    "installDroppedPackage",
    "uninstall",
    "purgeData",
    "rescan",
  ],
});
assertOnlyAllowedMethods({
  name: "preload preferences domain only defines its contract",
  pattern: String.raw`^  ([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/preload/api/preferences.ts"],
  allowed: ["list", "get", "set"],
});
assertOnlyAllowedMethods({
  name: "preload history domain only defines its contract",
  pattern: String.raw`^  ([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/preload/api/history.ts"],
  allowed: ["listRuns"],
});
assertOnlyAllowedDomainMethods({
  name: "renderer only calls the V1 Desktop API surface",
  pattern: String.raw`window\.tooldeck\.([a-zA-Z][a-zA-Z0-9]+)\.([a-zA-Z][a-zA-Z0-9]+)\(`,
  paths: ["src/renderer"],
  allowed: allowedRendererApiMethods,
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

function assertMatchesOnlyInFiles({ name, pattern, paths, allowedFiles }) {
  const matches = findMatches(pattern, paths);
  const allowed = new Set(allowedFiles.map((filePath) => path.normalize(filePath)));
  const unexpected = matches.filter((match) => {
    const relativePath = path.relative(desktopRoot, match.filePath);
    return !allowed.has(relativePath);
  });

  if (matches.length === 0 || unexpected.length > 0) {
    failures.push(
      `${name}\nAllowed: ${allowedFiles.join(", ")}\n${
        unexpected.length > 0
          ? unexpected.map(formatMatch).join("\n")
          : `Expected at least one match for: ${pattern}`
      }`,
    );
  }
}

function assertOnlyAllowedNamedImports({ name, filePath, moduleName, allowedSymbols }) {
  const absolutePath = path.resolve(desktopRoot, filePath);
  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  const escapedModuleName = escapeRegExp(moduleName);
  const moduleReference = new RegExp(
    String.raw`(?:from\s+["']${escapedModuleName}(?:/[^"']*)?["']|import\(["']${escapedModuleName}(?:/[^"']*)?["']\))`,
  );
  const namedImport = new RegExp(
    String.raw`^\s*import\s+\{\s*([^}]+?)\s*\}\s+from\s+["']${escapedModuleName}["'];?\s*$`,
  );
  const references = lines.filter((line) => moduleReference.test(line));
  const match = references.length === 1 ? references[0].match(namedImport) : undefined;
  const importedSymbols = match
    ? match[1]
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean)
    : [];
  const allowed = new Set(allowedSymbols);
  const imported = new Set(importedSymbols);
  const extra = importedSymbols.filter(
    (symbol) => symbol.includes(" as ") || symbol.startsWith("type ") || !allowed.has(symbol),
  );
  const missing = allowedSymbols.filter((symbol) => !imported.has(symbol));

  if (!match || extra.length > 0 || missing.length > 0) {
    failures.push(
      `${name}\nFile: ${filePath}\nAllowed: ${allowedSymbols.join(", ")}\nFound: ${
        importedSymbols.join(", ") || "(no single-line named import)"
      }`,
    );
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

function assertOnlyAllowedDomainMethods({ name, pattern, paths, allowed, requireAll = true }) {
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
      found.add(`${match[1]}.${match[2]}`);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
