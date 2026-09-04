import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { syncReleaseVersions } from "../sync-release-versions.mjs";

function withWorkspace(run) {
  const root = mkdtempSync(path.join(tmpdir(), "tooldeck-version-test-"));
  const write = (file, metadata) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(metadata));
  };
  const read = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
  try {
    write("package.json", { name: "tooldeck", version: "1.1.0", private: true });
    for (const [group, name] of [
      ["packages", "protocol"],
      ["packages", "json-schema"],
      ["internal", "runtime-node"],
      ["apps", "desktop"],
      ["plugins", "json-tools"],
      ["tests", "integration"],
    ]) {
      write(`${group}/${name}/package.json`, {
        name: `@tooldeck/${name}`,
        version: "1.4.0",
        private: group !== "packages",
      });
    }
    write("plugins/json-tools/manifest.json", {
      id: "dev.tooldeck.json-tools",
      version: "1.3.0",
      schemaVersion: "1.0",
    });
    run({ root, write, read });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("synchronizes release metadata while preserving private markers and protocol schemaVersion", () => {
  withWorkspace(({ root, read }) => {
    const result = syncReleaseVersions(root);
    assert.equal(result.version, "1.4.0");
    assert.equal(result.packageCount, 6);
    assert.deepEqual(read("package.json"), { name: "tooldeck", version: "1.4.0", private: true });
    assert.deepEqual(read("plugins/json-tools/manifest.json"), {
      id: "dev.tooldeck.json-tools",
      version: "1.4.0",
      schemaVersion: "1.0",
    });
    assert.equal(read("internal/runtime-node/package.json").private, true);
    assert.deepEqual(syncReleaseVersions(root, { check: true }).updatedFiles, []);
  });
});

test("check reports stale metadata without modifying files", () => {
  withWorkspace(({ root, read }) => {
    assert.throws(() => syncReleaseVersions(root, { check: true }), /Release metadata differs/);
    assert.equal(read("package.json").version, "1.1.0");
    assert.equal(read("plugins/json-tools/manifest.json").version, "1.3.0");
  });
});

test("package version drift aborts synchronization before any metadata changes", () => {
  withWorkspace(({ root, write, read }) => {
    write("internal/runtime-node/package.json", {
      name: "@tooldeck/runtime-node",
      version: "0.0.0",
      private: true,
    });
    assert.throws(() => syncReleaseVersions(root), /Workspace versions differ/);
    assert.equal(read("package.json").version, "1.1.0");
    assert.equal(read("plugins/json-tools/manifest.json").version, "1.3.0");
  });
});
