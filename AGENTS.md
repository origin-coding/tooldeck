# tooldeck Agent Instructions

## Project Context

`tooldeck` is a desktop toolbox project based on the Toolbox Plugin Protocol (TPP).

TPP treats plugins as declared and callable capabilities, not UI components. A plugin can contribute commands, documents, tables, views, menus, settings, and file handlers through a static manifest.

The full TPP v1 design lives in:

```text
docs/architecture/tpp-v1.md
```

Read that document when changing protocol, runtime, plugin, storage, CLI, or desktop architecture.

## First Version Stack

Use these technologies for the first version:

```text
Electron
React
TypeScript
electron-vite
pnpm workspace
SQLite
Drizzle ORM
better-sqlite3
```

The project should be a monorepo.

## MVP Scope

The first implementation milestone is a trusted local-plugin MVP:

```text
Desktop + CLI
Manifest scanning
Lazy plugin activation
Node plugin host
CommandRegistry
ContentBlock command results
SQLite plugin registry
SQLite command run history
Plugin scoped KV
json-tools example plugin
json.format command
```

MVP success criteria:

```text
Desktop can list and run json.format.
CLI can run: tooldeck run json.format --text '{"a":1}'
Manifest can be scanned without activating plugin code.
Plugin activates only when a matching command/document/table is used.
Command execution writes a record to SQLite.
```

## Recommended Structure

Start with this reduced structure:

```text
apps/
  desktop/
  cli/

packages/
  protocol/
  core/
  sdk/
  host-node/
  storage/
  shared/

plugins/
  json-tools/

docs/
  architecture/
```

## Architecture Rules

Follow these constraints:

1. `packages/protocol` must not depend on Electron, React, SQLite, Node plugin runtime, or UI code.
2. `packages/core` must not depend on Electron UI or React.
3. Renderer code must not access SQLite directly.
4. Renderer code must not import or execute plugin code directly.
5. Plugin capabilities must be exposed through `PluginContext`.
6. Commands must return structured `ContentBlock` results, not React/Vue/UI components.
7. Manifest data is static declaration; scanning a manifest must not run plugin code.
8. Plugins should activate lazily through activation events such as `onCommand:<id>`.
9. Plugin registration APIs must return `Disposable`.
10. Display text should use `LocalizedString` where protocol-facing.
11. JSON Schema should stay standards-compatible; use `x-i18n` and `x-ui` for extensions.
12. First version supports trusted local plugins only.
13. Permission support in v1 is declaration and persistence, not a full sandbox.
14. SQLite stores core state only; large files belong on the file system and secrets belong in secure storage.
15. All packages must use TypeScript.

## Do Not Build In V1

Do not implement these in the first version unless explicitly requested:

```text
Plugin marketplace
Remote plugin installation
Untrusted plugin sandbox
WASM plugin runtime
MCP adapter
OpenAPI adapter
Plugin signing
Plugin dependency resolution
Plugin hot reload
Complex permission dialogs
Complex custom view plugins
Renderer database access
Renderer plugin execution
```

## Implementation Preference

Prefer a small, working vertical slice over a broad skeleton.

The first vertical slice should prove:

```text
manifest scan -> command list -> lazy activation -> json.format execution -> ContentBlock output -> SQLite command history
```

## Commit Message Style

When asked to generate a commit message, first inspect recent commit history with `git log` and match the repository's existing style.

Use Conventional Commit titles:

```text
feat(scope): short summary
fix(scope): short summary
test(scope): short summary
docs(scope): short summary
```

Prefer the current project format:

```text
feat(scope): short summary

- Add the primary behavior or package change
- Describe related integration or API updates
- Mention example/plugin/test updates when relevant
- Mention documentation updates when relevant
```

Keep the title concise and use the body for concrete bullets. Do not invent a body style without checking recent commits first.
