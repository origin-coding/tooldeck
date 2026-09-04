import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncReleaseVersions } from "./sync-release-versions.mjs";

export function checkReleaseRef(root, { ref, sha } = {}) {
  const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("A release requires a stable major.minor.patch version.");
  }
  const tag = `v${version}`;
  if (ref !== `refs/tags/${tag}`) {
    throw new Error(`Start this workflow from refs/tags/${tag}; received ${ref ?? "no ref"}.`);
  }
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error("A release requires the workflow commit SHA.");
  }

  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  const commit = git("rev-parse", "HEAD");
  if (commit !== sha) {
    throw new Error("Checkout HEAD does not match the workflow commit SHA.");
  }
  let tagCommit;
  try {
    tagCommit = git("rev-parse", "--verify", `refs/tags/${tag}^{commit}`);
  } catch {
    throw new Error(`Release tag ${tag} is missing. Fetch the release tags before verification.`);
  }
  if (tagCommit !== commit) {
    throw new Error(
      `Release tag ${tag} does not match the workflow commit. Do not move release tags.`,
    );
  }

  syncReleaseVersions(root, { check: true });
  return { tag, commit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const release = checkReleaseRef(root, {
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
  });
  console.log(`Verified ${release.tag} at ${release.commit}.`);
}
