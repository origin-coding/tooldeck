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

Tooldeck is a TypeScript pnpm workspace built with Electron, React, electron-vite, SQLite,
Drizzle ORM, and the built-in `node:sqlite` driver.

Common repository checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm check:desktop-boundaries
pnpm smoke:cli
```

Build and stage built-in plugins separately when preparing application artifacts:

```bash
pnpm builtin-plugins:build
pnpm builtin-plugins:stage
```

## Architecture

TPP treats plugins as declared and callable capabilities, not UI components. The current
Tooldeck implementation keeps these boundaries:

- `packages/protocol` contains data contracts and standards-facing JSON Schema only.
- `packages/sdk-node` provides the public Node plugin authoring contract.
- `packages/runtime-node` coordinates scanning, commands, validation, and lazy activation.
- `packages/host-node` loads trusted local Node plugin runtime entries.
- `packages/plugin-package` owns the public `.tdplugin` container implementation.
- `packages/plugin-management-node` shares install and state orchestration between CLI and
  Desktop.
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
  runtime-node/             Private Node runtime coordination.
  host-node/                Node plugin loading adapter.
  plugin-package/           Public .tdplugin format utilities.
  plugin-management-node/   Private install and state application service.
  plugin-tools/             Public plugin authoring CLI and test helpers.
  vite-plugin/              Public Vite integration for Node plugins.
  create-plugin/            Public external plugin project generator.
  preferences/              Private product preference definitions.
  storage/                  Private SQLite persistence implementation.
  shared/                   Shared private implementation utilities.

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
