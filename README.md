# Tooldeck

Tooldeck is a trusted local-plugin desktop toolbox based on the Toolbox Plugin Protocol
(TPP). Plugins declare capabilities in a static manifest and expose commands through a
Node runtime; the desktop app and CLI scan manifests without executing plugin code, then
activate a plugin lazily only when a matching capability is used.

Current Tooldeck 1.3 focus:

- Desktop + CLI for trusted local plugins.
- Static manifest scanning.
- Lazy Node plugin activation.
- CommandRegistry and structured `ContentBlock` command results.
- SQLite-backed plugin registry, command run history, and plugin-scoped KV storage.
- Local `.tdplugin` packaging, installation, enable/disable, uninstall, and retained-data purge.
- Built-in, installed, and explicitly configured external plugin sources.
- Built-in example plugins such as `json-tools` and `json.format`.

## Stack

- Electron
- React
- TypeScript
- electron-vite
- pnpm workspace
- SQLite
- Drizzle ORM
- `node:sqlite`

## Repository Layout

```text
apps/
  desktop/        Electron desktop app.
  cli/            Tooldeck command-line interface.

packages/
  protocol/       TPP types and JSON Schema.
  preferences/    Private Tooldeck product preference definitions and validation.
  runtime-node/   Node runtime coordination, manifest scanning, command registry.
  sdk-node/       SDK for Node plugins.
  host-node/      Node plugin host.
  storage/        SQLite storage layer.
  plugin-package/ Public .tdplugin format, validation, and archive utilities.
  plugin-management-node/
                  Shared private install, catalog, state, and purge service.
  plugin-tools/   Plugin authoring CLI and project checks.
  vite-plugin/    Vite integration for Node plugins.
  create-plugin/  External plugin project generator.
  shared/         Shared TypeScript utilities.

plugins/
  json-tools/     Built-in JSON command plugin.
  regex-tools/    Built-in regex command plugin.
  hello-world/    Minimal development plugin.

docs/
  architecture/   TPP and runtime architecture.
  planning/       Version planning notes.
  plugin-authoring/
                  Current external plugin authoring workflow.
```

## Local Plugin Workflow

Tooldeck 1.3 completes the trusted local-plugin distribution loop. From an external
plugin project:

```bash
pnpm check
pnpm build
pnpm exec tooldeck-plugin pack
```

`tooldeck-plugin pack` creates `<plugin-id>-<version>.tdplugin` by default. Use
`tooldeck-plugin dist` to build and package in one command, or `--output <file>` to choose
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

`uninstall` removes only Tooldeck-managed plugin files and preserves plugin state,
plugin-scoped KV, and command history. After uninstall, `purge` removes the retained state
and plugin-scoped KV; command history remains available.

The Desktop Plugins workbench accepts one local `.tdplugin` file by drag and drop. It can
enable or disable plugins, uninstall managed installed plugins, and purge retained data.
Tooldeck continues to treat all local plugins as trusted code; 1.3 does not introduce a
sandbox.

## Development

Install dependencies:

```bash
pnpm install
```

Build all workspace packages:

```bash
pnpm build
```

Run type checks and tests:

```bash
pnpm typecheck
pnpm test:run
```

Run the CLI in development:

```bash
pnpm dev:cli -- list commands
pnpm dev:cli -- run json.format --text '{"a":1}'
```

Run the desktop app in development:

```bash
pnpm dev:desktop
```

Build and stage built-in plugins:

```bash
pnpm builtin-plugins:build
pnpm builtin-plugins:stage
```

## Plugin Authoring

Create an external plugin project:

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin
cd my-tooldeck-plugin
pnpm install
pnpm check
pnpm build
pnpm exec tooldeck-plugin pack
```

Verify it from a Tooldeck workspace:

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

See [Plugin Authoring](docs/plugin-authoring/README.md) for the current commands-only
Node plugin workflow.

## Architecture Notes

Read these before changing protocol, runtime, plugin, storage, CLI, or desktop
architecture:

- [TPP v1](docs/architecture/tpp-v1.md)
- [V1 Scope](docs/architecture/v1-scope.md)
- [CLI-first MVP](docs/architecture/cli-first-mvp.md)
- [Tooldeck 1.2 Planning](docs/planning/1.2.md)
- [Tooldeck 1.3 Planning and Implementation Status](docs/planning/1.3.md)

Important V1 boundaries:

- `packages/protocol` does not depend on Electron, React, SQLite, Node plugin runtime, or UI code.
- `packages/preferences` is private Tooldeck product code; preferences are not part of TPP.
- Renderer code does not access SQLite directly.
- Renderer code does not import or execute plugin code directly.
- Manifest scanning must not run plugin code.
- Plugins expose capabilities through `PluginContext`.
- Commands return structured `ContentBlock` results, not UI components.
- V1 supports trusted local plugins only.

## V1 Non-goals

Tooldeck V1 supports installation from trusted local `.tdplugin` files. It does not
include a plugin marketplace, remote plugin installation, untrusted sandboxing, WASM
runtime, MCP/OpenAPI adapters, plugin signing, plugin dependency resolution, plugin hot
reload, or complex custom view plugins.
