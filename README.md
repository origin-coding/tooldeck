# Tooldeck

[![PR check](https://github.com/origin-coding/tooldeck/actions/workflows/pr-check.yml/badge.svg)](https://github.com/origin-coding/tooldeck/actions/workflows/pr-check.yml) [![Release dry-run](https://github.com/origin-coding/tooldeck/actions/workflows/release-dry-run.yml/badge.svg?branch=main)](https://github.com/origin-coding/tooldeck/actions/workflows/release-dry-run.yml) [![GitHub release](https://img.shields.io/github/v/release/origin-coding/tooldeck?sort=semver&display_name=tag)](https://github.com/origin-coding/tooldeck/releases/latest)

Tooldeck is a desktop toolbox and CLI for running trusted local plugins through the
manifest-driven Toolbox Plugin Protocol (TPP).

[Desktop](apps/desktop/README.md) · [CLI](apps/cli/README.md) ·
[Plugin Authoring](docs/plugin-authoring/README.md) ·
[TPP Architecture](docs/architecture/tpp-v1.md)

## Highlights

- Run the same manifest-declared commands from Desktop or CLI.
- Discover plugin capabilities without importing or executing runtime code.
- Activate trusted local Node plugins lazily when a matching command is invoked.
- Return structured `ContentBlock` results instead of framework-specific UI components.
- Persist the plugin catalog, command history, preferences, and plugin-scoped KV in SQLite.
- Build and install local `.tdplugin` packages through a shared CLI and Desktop lifecycle.
- Keep built-in, installed, and explicitly configured external plugin sources distinct.

Tooldeck 1.3 completes the local plugin lifecycle with packaging, installation,
enable/disable, uninstall, and retained-data purge.

## Quick Start

Install dependencies and build the workspace:

```bash
pnpm install
pnpm build
```

List and run built-in commands through the development CLI:

```bash
pnpm dev:cli -- list commands
pnpm dev:cli -- run json.format --text '{"a":1}'
```

Start the Desktop app:

```bash
pnpm dev:desktop
```

`json-tools` and its `json.format` command are the canonical smoke test for manifest
scanning, lazy activation, structured output, and SQLite command history.

## Local Plugin Workflow

From a built external plugin project, create an installable local package:

```bash
pnpm check
pnpm build
pnpm exec tooldeck-plugin pack
```

`tooldeck-plugin pack` creates `<plugin-id>-<version>.tdplugin` by default. Use
`tooldeck-plugin dist` to build and package in one command, or `--output <file>` to select
the output path.

Install and manage the package with the CLI:

```bash
tooldeck plugin install ./dev.example.my-plugin-0.1.0.tdplugin
tooldeck plugin list
tooldeck run my.command
tooldeck plugin disable dev.example.my-plugin
tooldeck plugin enable dev.example.my-plugin
tooldeck plugin uninstall dev.example.my-plugin
tooldeck plugin purge dev.example.my-plugin
```

`uninstall` removes Tooldeck-managed plugin files while preserving plugin state,
plugin-scoped KV, and command history. After uninstall, `purge` removes the retained state
and plugin-scoped KV; command history remains available.

The Desktop Plugins workbench accepts one local `.tdplugin` file by drag and drop. It can
enable or disable plugins, uninstall managed installed plugins, and purge retained data.

## Plugin Authoring

Create an external commands-only Node plugin project:

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin
cd my-tooldeck-plugin
pnpm install
pnpm check
pnpm build
pnpm exec tooldeck-plugin pack
```

Verify the project directly from a Tooldeck workspace without installing it:

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

`--plugin-dir` adds a trusted external development source. It does not replace built-in or
installed sources and does not copy the plugin into Tooldeck's managed installation
directory.

See the [Plugin Authoring Guide](docs/plugin-authoring/README.md) for manifest structure,
generated command types, SDK usage, packaging rules, and installation verification.

## Development

Tooldeck is a TypeScript pnpm workspace built with Electron, Nuxt, Vue, TDesign, SQLite,
Drizzle ORM, and the built-in `node:sqlite` driver. The renderer uses Pinia, Nuxt I18n,
and UnoCSS; Vite builds the Electron main and preload processes.

Run the same verification sequence as CI:

```bash
pnpm verify
```

This checks formatting and lint, builds the workspace, checks types, runs package and
built-in staging tests, checks Desktop boundaries and Ajv artifacts, and runs the built
CLI smoke test outside the workspace. Each check remains available as an individual
root package script.

Build and stage built-in plugins separately when preparing application artifacts:

```bash
pnpm builtin-plugins:build
pnpm builtin-plugins:stage -- --out apps/cli/dist/plugins --skip-build
pnpm builtin-plugins:stage -- --out apps/desktop/.vite/builtin-plugins --skip-build
```

The build command includes the plugins' workspace build dependencies. Staging packages
each plugin as a temporary `.tdplugin`, validates and unpacks it, and checks that its
runtime entry can be imported outside the workspace without activating the plugin.
The package file collector includes declared runtime/locale files plus `dist` and
`assets`; files needed at runtime must be included in that package layout. Root
authoring `package.json` files are not copied into the staged plugins.

Staging replaces the previous output only after every selected plugin passes. Temporary
archives and unpacked directories are cleaned on success and failure. If replacing the
output and restoring it both fail, the previous output is retained at the reported backup
path for recovery. Desktop and CLI ship expanded directories with source kind `builtin`;
no post-install extraction or
plugin installation records are involved. Production staging excludes development-only
plugins; pass `--mode development` to include them. `--skip-build` skips compilation,
but still performs packaging and runtime checks.

After building the workspace, run `pnpm test:builtin-plugins` for the staging regression
suite (also included in `pnpm test:run`).

## Release Versions

Tooldeck uses one release version across its public packages, private packages, CLI,
Desktop, and built-in plugins. Changesets manages these workspace packages as one fixed
group. Private packages remain private and are excluded from npm publication.

Maintainers run `pnpm version-packages` to apply pending changesets and synchronize the
root workspace and built-in plugin manifest versions. `pnpm check:release-versions`
checks alignment and is included in `pnpm verify`. TPP schema versions and historical
compatibility fixtures retain their own version semantics.

Formal npm and Desktop publication uses `release.yml` from the matching `v<version>` tag.
Every job checks out the workflow commit SHA, and publication verifies that the tag
points to that commit. Verification and npm publish dry-run complete first, followed by
all three Desktop builds. Only then can npm publication and GitHub Release asset upload
proceed, using their separate production environments.

Pushing the release tag starts the complete workflow. `desktop-release.yml` is an internal
reusable build workflow and is not dispatched separately. Existing release assets are
not overwritten automatically; inspect partial uploads before retrying.

## Architecture

TPP treats plugins as declared and callable capabilities, not UI components. The current
Tooldeck implementation keeps these boundaries:

- `packages/protocol` contains data contracts and standards-facing JSON Schema only.
- `packages/json-schema` provides public, Effect-neutral Draft-07 execution without exposing
  Ajv types. It is the single shared Ajv execution source for Tooldeck profiles, while
  `packages/protocol` remains their data-only source of truth.
- `packages/sdk-node` provides the public Node plugin authoring contract.
- `internal/runtime-node` coordinates scanning, commands, validation, runtime-kind routing,
  lazy activation, and trusted local Node plugin loading.
- `packages/plugin-package` owns the public `.tdplugin` container implementation.
- `internal/runtime-node`, `packages/plugin-tools`, and `packages/plugin-package` keep
  lifecycle/errors, author diagnostics, and package safety as owner-specific adapters over
  the shared JSON Schema engine.
- `internal/application-node` owns database, preferences, history, plugin management, and the
  application facade shared by CLI and Desktop main.
- Renderer code does not access SQLite or import and execute plugin code directly.
- Manifest scanning, installation, uninstall, and purge do not activate plugin runtime code.

Read these documents before changing protocol, runtime, plugin, storage, CLI, or Desktop
architecture:

- [TPP v1](docs/architecture/tpp-v1.md)
- [V1 Scope](docs/architecture/v1-scope.md)
- [CLI-first MVP](docs/architecture/cli-first-mvp.md)
- [Tooldeck 1.2 Planning](docs/planning/1.2.md)
- [Tooldeck 1.3 Planning and Implementation Status](docs/planning/1.3.md)
- [Architecture Decision Records](docs/architecture/decisions/README.md)

## Repository Layout

```text
apps/
  desktop/                  Electron desktop application.
  cli/                      Tooldeck command-line application.

packages/
  protocol/                 TPP data contracts and schema.
  sdk-node/                 Public Node plugin authoring contract.
  plugin-package/           Public .tdplugin format utilities.
  plugin-tools/             Public plugin authoring CLI and test helpers.
  vite-plugin/              Public Vite integration for Node plugins.
  create-plugin/            Public external plugin project generator.

internal/
  runtime-node/             Private runtime coordination and Node plugin host.
  application-node/         Private database and product application facade.

plugins/
  json-tools/               Canonical JSON command and smoke-test plugin.
  regex-tools/              Built-in regex command plugin.
  hello-world/              Minimal development plugin.

docs/
  architecture/             Protocol, implementation boundaries, and ADRs.
  planning/                 Historical version planning and implementation status.
  plugin-authoring/         Current external plugin authoring guide.
```

## Scope and Non-goals

Tooldeck currently supports commands-only, trusted local plugins. Local package validation
is not a security sandbox.

Tooldeck V1 does not include a plugin marketplace, remote plugin installation, plugin
signing, an untrusted plugin sandbox, WASM runtime, MCP or OpenAPI adapters, plugin
dependency resolution, plugin hot reload, or complex custom view plugins.

## License

Tooldeck is licensed under the [Apache License 2.0](LICENSE).
