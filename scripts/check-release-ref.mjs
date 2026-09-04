import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function checkReleaseRef(root, { ref, requestedTag } = {}) {
  const readVersion = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8")).version;
  const version = readVersion("apps/desktop/package.json");
  const tag = `v${version}`;
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`Expected a stable release version, received ${tag}.`);
  }
  if (readVersion("apps/cli/package.json") !== version) {
    throw new Error("CLI and Desktop release versions must match.");
  }
  if (requestedTag && requestedTag !== tag) {
    throw new Error(`Requested tag ${requestedTag} does not match ${tag}.`);
  }
  if (ref !== `refs/tags/${tag}`) {
    throw new Error(`Run the release workflow from refs/tags/${tag}, received ${ref ?? "no ref"}.`);
  }
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD");
  if (git("rev-parse", "--verify", `refs/tags/${tag}^{commit}`) !== commit) {
    throw new Error(`Checkout HEAD does not match ${tag}. Do not move a published tag.`);
  }
  return { tag, commit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = checkReleaseRef(root, {
    ref: process.env.GITHUB_REF,
    requestedTag: process.env.RELEASE_TAG,
  });
  console.log(`Verified release ${result.tag} at ${result.commit}.`);
}
