import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { checkReleaseRef } from "../check-release-ref.mjs";

test("release workflows require the versioned tag and its immutable checkout", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tooldeck-release-ref-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  const setVersion = (app, version) => {
    mkdirSync(path.join(root, "apps", app), { recursive: true });
    writeFileSync(path.join(root, "apps", app, "package.json"), JSON.stringify({ version }));
  };
  try {
    git("init");
    git("config", "user.name", "Release ref test");
    git("config", "user.email", "release-ref@example.invalid");
    setVersion("cli", "1.4.0");
    setVersion("desktop", "1.4.0");
    git("add", ".");
    git("-c", "commit.gpgsign=false", "commit", "-m", "Release fixture");
    git("-c", "tag.gpgsign=false", "tag", "v1.4.0");
    const options = { ref: "refs/tags/v1.4.0", requestedTag: "v1.4.0" };
    assert.deepEqual(checkReleaseRef(root, options), {
      tag: "v1.4.0",
      commit: git("rev-parse", "HEAD"),
    });
    for (const invalid of [
      { ref: "refs/heads/main" },
      { ref: "refs/tags/v1.3.0" },
      { ...options, requestedTag: "v1.3.0" },
      {},
    ]) {
      assert.throws(() => checkReleaseRef(root, invalid), /workflow from|Requested tag/);
    }
    setVersion("cli", "1.3.0");
    assert.throws(() => checkReleaseRef(root, options), /versions must match/);
    setVersion("cli", "1.4.0");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "After release");
    assert.throws(() => checkReleaseRef(root, options), /HEAD does not match/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
