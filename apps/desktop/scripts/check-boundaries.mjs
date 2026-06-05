import { spawnSync } from "node:child_process";

const rendererAndPreload = ["src/renderer", "src/preload"];
const allowedDesktopApiMethods = [
  "listCommands",
  "listPlugins",
  "setPluginEnabled",
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
    name: "main service composes core, host-node, and storage",
    pattern: String.raw`@tooldeck/(core|host-node|storage)`,
    paths: ["src/main"],
    expect: "match",
  },
];

const failures = [];

for (const check of checks) {
  const result = runRg(check.pattern, check.paths);

  const matched = result.status === 0;

  if (check.expect === "no-match" && matched) {
    failures.push(`${check.name}\n${result.stdout.trim()}`);
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
});

if (failures.length > 0) {
  console.error(`Desktop boundary checks failed:\n\n${failures.join("\n\n")}`);
  process.exit(1);
}

console.log("Desktop boundary checks passed.");

function assertRequiredMatch({ name, pattern, paths }) {
  const result = runRg(pattern, paths);

  if (result.status !== 0) {
    failures.push(`${name}\nExpected at least one match for: ${pattern}`);
  }
}

function assertOnlyAllowedMethods({ name, pattern, paths, allowed }) {
  const result = runRg(pattern, paths);
  const expression = new RegExp(pattern);

  if (result.status !== 0) {
    failures.push(`${name}\nExpected at least one API method match for: ${pattern}`);
    return;
  }

  const found = new Set();

  for (const line of result.stdout.trim().split(/\r?\n/)) {
    const text = line.replace(/^(?:[^:]+:)?\d+:/, "");
    const match = text.match(expression);

    if (match) {
      found.add(match[1]);
    }
  }

  const extra = [...found].filter((method) => !allowed.includes(method));
  const missing = allowed.filter((method) => !found.has(method));

  if (extra.length > 0 || missing.length > 0) {
    failures.push(
      `${name}\nAllowed: ${allowed.join(", ")}\nFound: ${[...found].join(", ") || "(none)"}`,
    );
  }
}

function runRg(pattern, paths) {
  const result = spawnSync("rg", ["--line-number", pattern, ...paths], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}
