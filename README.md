# Tooldeck

Tooldeck is a trusted local-plugin desktop toolbox based on the Toolbox Plugin Protocol
(TPP). Plugins declare capabilities in a static manifest and expose commands through a
Node runtime; the desktop app and CLI scan manifests without executing plugin code, then
activate a plugin lazily only when a matching capability is used.

Current V1 focus:

- Desktop + CLI for trusted local plugins.
- Static manifest scanning.
- Lazy Node plugin activation.
- CommandRegistry and structured `ContentBlock` command results.
- SQLite-backed plugin registry, command run history, and plugin-scoped KV storage.
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
  runtime-node/   Node runtime coordination, manifest scanning, command registry.
  sdk-node/       SDK for Node plugins.
  host-node/      Node plugin host.
  storage/        SQLite storage layer.
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
```

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
pnpm test
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

Important V1 boundaries:

- `packages/protocol` does not depend on Electron, React, SQLite, Node plugin runtime, or UI code.
- Renderer code does not access SQLite directly.
- Renderer code does not import or execute plugin code directly.
- Manifest scanning must not run plugin code.
- Plugins expose capabilities through `PluginContext`.
- Commands return structured `ContentBlock` results, not UI components.
- V1 supports trusted local plugins only.

## V1 Non-goals

Tooldeck V1 does not include a plugin marketplace, remote plugin installation,
untrusted sandboxing, WASM runtime, MCP/OpenAPI adapters, plugin signing, plugin
dependency resolution, plugin hot reload, or complex custom view plugins.
