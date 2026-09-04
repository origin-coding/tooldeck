# Releasing Tooldeck

Release execution and acceptance evidence live in
[#42](https://github.com/origin-coding/tooldeck/issues/42). This guide describes the
maintainer workflow; it does not certify that a release has passed its acceptance checks.

## Tooldeck 1.4 version matrix

| Artifact                                    | Version  |
| ------------------------------------------- | -------- |
| Git tag / GitHub Release                    | `v1.4.0` |
| Desktop / `@tooldeck/cli`                   | `1.4.0`  |
| `@tooldeck/protocol`                        | `1.4.0`  |
| `@tooldeck/sdk-node`                        | `1.4.0`  |
| `@tooldeck/plugin-tools`                    | `1.4.0`  |
| `@tooldeck/vite-plugin`                     | `1.4.0`  |
| `@tooldeck/create-plugin`                   | `1.4.0`  |
| `@tooldeck/plugin-package`                  | `0.2.0`  |
| `@tooldeck/json-schema` (first publication) | `0.1.0`  |

The root workspace version is historical metadata (`1.1.0`), not the product version.
Private internal packages remain `0.0.0`; private fixtures and built-in plugins keep their
own versions. Changesets does not version or tag private packages. Desktop is versioned
explicitly. The generator's version selects the `^1.4.0` SDK/protocol/tooling ranges, so
those public packages must be released together. Never publish `internal/*` or republish
the superseded private implementation packages.

## Prepare and verify

1. Finish the release changes and merge the release PR. Freeze its resulting commit.
2. In a clean checkout of that commit with Node 24 and the repository's pnpm version, run:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm verify
   pnpm run publish:npm-trusted -- --dry-run
   ```

3. Inspect public packed manifests, exports and declarations for unresolved `workspace:` /
   `catalog:` protocols, missing files and private dependencies/types. Use `pnpm pack` so
   workspace and Catalog dependency versions are resolved before `npm publish`.
4. Record authentic 1.3 compatibility and isolated external authoring/lifecycle evidence
   in #42. Run create/check/build/pack/install/run using packed public packages outside
   the workspace, then history, disable/failed run/enable/successful run/uninstall/purge.
5. Build all Desktop platforms without publishing:

   ```powershell
   gh workflow run desktop-release.yml --ref main -f dry_run=true
   ```

   Confirm the run's `headSha` is the frozen commit. Download its CI artifacts for
   acceptance. Record actual Windows, Linux and macOS test depth separately: building
   NSIS/MSI, AppImage and DMG does not prove installation or launch. Test packaged Desktop
   outside workspace `node_modules`, navigation/refresh, assets/locales, `json.format`,
   history/preferences, drag-and-drop install and the complete plugin lifecycle.

6. Resolve release blockers before creating `v1.4.0`. Use the
   [release notes](releases/1.4.0.md) for the GitHub Release after publication.

All workflows use the shared `pnpm verify` gate and frozen lockfile setup. The npm and
Desktop publishing workflows additionally require the selected workflow ref to be the
versioned tag, with CLI/Desktop versions and checkout HEAD matching that tag.

## First publication of json-schema

Perform these steps only after the release commit has passed acceptance. Run the commands
from a clean checkout of that frozen commit. Do not publish from an unmerged release
branch: a squash merge would produce a different release commit.

Create the local tag without pushing it yet. Verify the commit and working tree first:

```powershell
git status --short
git rev-parse HEAD
git tag -a v1.4.0 -m "Tooldeck 1.4.0"
git rev-parse 'v1.4.0^{commit}'
pnpm install --frozen-lockfile
pnpm build
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

If the tag already exists, verify its commit and reuse it; never force or move it.

`json-schema@0.1.0` depends on `protocol@1.4.0`. Publish protocol first if it is not
already available from this release commit, then publish json-schema. This avoids making
the new package available with an unresolved dependency. Both packages are packed from
the same checkout; the automated publisher will skip these exact versions afterward.

The following PowerShell block uses a new temporary directory and cleans it even after
failure. An authenticated account with publish access to the `@tooldeck` scope is required.
Complete npm's interactive authentication/2FA prompts yourself.

```powershell
$releasePackDir = Join-Path ([System.IO.Path]::GetTempPath()) ("tooldeck-first-publish-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $releasePackDir | Out-Null
try {
  pnpm --filter @tooldeck/protocol pack --pack-destination $releasePackDir
  if ($LASTEXITCODE -ne 0) { throw "Protocol pack failed" }
  pnpm --filter @tooldeck/json-schema pack --pack-destination $releasePackDir
  if ($LASTEXITCODE -ne 0) { throw "JSON Schema pack failed" }

  $protocolTarball = Join-Path $releasePackDir 'tooldeck-protocol-1.4.0.tgz'
  $schemaTarball = Join-Path $releasePackDir 'tooldeck-json-schema-0.1.0.tgz'
  npm publish $protocolTarball --access public --provenance=false --dry-run --registry=https://registry.npmjs.org/
  if ($LASTEXITCODE -ne 0) { throw "Protocol dry-run failed" }
  npm publish $schemaTarball --access public --provenance=false --dry-run --registry=https://registry.npmjs.org/
  if ($LASTEXITCODE -ne 0) { throw "JSON Schema dry-run failed" }

  # If protocol@1.4.0 already exists from this release commit, omit only its publish command.
  npm publish $protocolTarball --access public --provenance=false --registry=https://registry.npmjs.org/
  if ($LASTEXITCODE -ne 0) { throw "Protocol publish failed; verify registry state before retrying" }
  npm publish $schemaTarball --access public --provenance=false --registry=https://registry.npmjs.org/
  if ($LASTEXITCODE -ne 0) { throw "JSON Schema publish failed; verify registry state before retrying" }
} finally {
  Remove-Item -LiteralPath $releasePackDir -Recurse -Force
}
```

Local manual publication does not carry GitHub Actions provenance. Configure future
publication in the new package's npm Settings → Trusted Publisher:

| Field                | Value                      |
| -------------------- | -------------------------- |
| Provider             | GitHub Actions             |
| Organization or user | `origin-coding`            |
| Repository           | `tooldeck`                 |
| Workflow filename    | `release.yml`              |
| Environment          | `npm-production`           |
| Allowed actions      | Allow direct `npm publish` |

Enter only the workflow filename. npm now defaults new configurations to staged
publication, while this repository calls `npm publish` directly. See the official
[trusted publisher documentation](https://docs.npmjs.com/trusted-publishers/) and
[scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

Verify both versions before continuing:

```powershell
npm view @tooldeck/protocol@1.4.0 version --registry=https://registry.npmjs.org/
npm view @tooldeck/json-schema@0.1.0 version dependencies dist.integrity --json --registry=https://registry.npmjs.org/
```

## Publish the remaining release

```powershell
git push origin v1.4.0
```

The tag triggers `release.yml`. Approve `npm-production` if the environment requires it.
The publisher checks versions, skips already published packages and publishes in order:
protocol → json-schema → sdk-node → plugin-package → vite-plugin → plugin-tools →
create-plugin → CLI. Verify the run is green and all eight target versions exist.

Then build and publish Desktop from the same tag:

```powershell
gh workflow run desktop-release.yml --ref v1.4.0 -f tag=v1.4.0 -f dry_run=false
```

Approve `desktop-production` if required. Supply the release notes afterward:

```powershell
gh release edit v1.4.0 --title "Tooldeck Desktop v1.4.0" --notes-file docs/releases/1.4.0.md
```

Post-release, install the published CLI and author tooling in an isolated directory,
run `json.format`, create/build/package a plugin, and verify the downloaded Desktop
artifacts and release links. Record results in #42 and close it only after all acceptance
conditions are met.

After a partial npm failure, inspect registry state and retry the same tag only when the
commit is unchanged. If source changes are required after any publication, evaluate a
patch release. Existing GitHub Release assets are not overwritten automatically; inspect
partial uploads before retrying. Do not move tags or overwrite published versions.
