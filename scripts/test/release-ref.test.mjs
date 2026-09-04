import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { checkReleaseRef } from "../check-release-ref.mjs";

function withRepository(run) {
  const root = mkdtempSync(path.join(tmpdir(), "tooldeck-release-ref-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (file, metadata) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(metadata));
  };
  try {
    git("init");
    git("config", "user.name", "Release ref test");
    git("config", "user.email", "release-ref@example.invalid");
    git("config", "commit.gpgsign", "false");
    git("config", "tag.gpgsign", "false");
    write("package.json", { name: "tooldeck", version: "1.4.0", private: true });
    for (const [group, name] of [
      ["packages", "protocol"],
      ["apps", "cli"],
      ["apps", "desktop"],
    ]) {
      write(`${group}/${name}/package.json`, { name: `@tooldeck/${name}`, version: "1.4.0" });
    }
    git("add", ".");
    git("commit", "-m", "Release fixture");
    const sha = git("rev-parse", "HEAD");
    run({ root, git, write, sha });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const annotated of [false, true]) {
  test(`accepts a matching ${annotated ? "annotated" : "lightweight"} release tag`, () => {
    withRepository(({ root, git, sha }) => {
      if (annotated) git("tag", "-a", "v1.4.0", "-m", "Release fixture");
      else git("tag", "v1.4.0");
      assert.deepEqual(checkReleaseRef(root, { ref: "refs/tags/v1.4.0", sha }), {
        tag: "v1.4.0",
        commit: sha,
      });
    });
  });
}

test("rejects branch refs, version mismatches, missing tags and a different checkout", () => {
  withRepository(({ root, git, sha }) => {
    const options = { ref: "refs/tags/v1.4.0", sha };
    for (const ref of [undefined, "refs/heads/main", "refs/tags/v1.3.0"]) {
      assert.throws(() => checkReleaseRef(root, { ref, sha }), /Start this workflow from/);
    }
    assert.throws(() => checkReleaseRef(root, options), /tag v1.4.0 is missing/);
    git("tag", "v1.4.0");
    assert.throws(() => checkReleaseRef(root, { ref: options.ref }), /workflow commit SHA/);
    assert.throws(
      () => checkReleaseRef(root, { ...options, sha: "0".repeat(40) }),
      /HEAD does not match/,
    );
    git("commit", "--allow-empty", "-m", "After release");
    assert.throws(
      () => checkReleaseRef(root, { ...options, sha: git("rev-parse", "HEAD") }),
      /tag v1.4.0 does not match/,
    );
  });
});

test("rejects package version drift even when the release tag matches its commit", () => {
  withRepository(({ root, git, write }) => {
    write("apps/desktop/package.json", { name: "@tooldeck/desktop", version: "1.3.0" });
    git("add", ".");
    git("commit", "-m", "Mismatched app version");
    git("tag", "v1.4.0");
    assert.throws(
      () => checkReleaseRef(root, { ref: "refs/tags/v1.4.0", sha: git("rev-parse", "HEAD") }),
      /Workspace versions differ/,
    );
  });
});
