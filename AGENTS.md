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
node:sqlite
```

The project should be a monorepo.

## Current Project Stage

The project is preparing the Tooldeck 1.3 release. The current trusted local-plugin
vertical slice is:

```text
external plugin authoring
  -> build
  -> .tdplugin package
  -> CLI or Desktop install
  -> builtin / installed / external manifest scan
  -> lazy Node plugin activation
  -> command execution
  -> ContentBlock output
  -> SQLite command history
  -> enable / disable
  -> uninstall
  -> retained-data purge
```

The commands-only, trusted-local boundary still applies. Do not expand release-polish
work into marketplace, remote installation, signing, sandboxing, dependency resolution,
hot reload, or new TPP contribution types.

Current release success criteria include:

```text
Desktop can list and run json.format.
CLI can run: tooldeck run json.format --text '{"a":1}'
Manifest can be scanned without activating plugin code.
Plugin activates only when a matching command/document/table is used.
Command execution writes a record to SQLite.
An external plugin can build, pack, install, run, disable, enable, uninstall, and purge.
CLI and Desktop use the same Node plugin-management service.
```

## Repository Structure

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
  plugin-tools/              Public plugin authoring CLI and test helpers.
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

## Package Dependency Guide

Keep package dependencies layered by public contract and private implementation:

```text
@tooldeck/protocol
  TPP data contracts: manifest, command definitions, JSON Schema types,
  ContentBlock, CommandResult, LocalizedString, and JSON value types.

@tooldeck/sdk-node
  Public Node plugin authoring contract: definePlugin, PluginContext,
  CommandHandler, CommandRegistry, Disposable, PluginStorage, and ToolboxPlugin.

@tooldeck/runtime-node
  Private Node runtime implementation: manifest indexing, command orchestration,
  lazy activation coordination, lifecycle state machines, input normalization,
  result validation, and plugin manager services.

@tooldeck/host-node
  Node plugin loading adapter and runtime assembly helpers.

@tooldeck/plugin-package
  Public .tdplugin container implementation: package metadata, ZIP adapter,
  validation, safe unpacking, digest calculation, and package limits.

@tooldeck/plugin-management-node
  Private Tooldeck Node application service: catalog synchronization, install,
  uninstall, enable/disable coordination, retained-data purge, rollback, and cleanup
  reporting shared by CLI and Desktop.

@tooldeck/plugin-tools
  Public plugin-author workflow: generate, check, build, inspect, pack, dist, and
  command-handler testing helpers.
```

Dependency direction should stay one-way:

```text
protocol <- sdk-node <- runtime-node <- host-node <- CLI/Desktop
protocol <- plugin-package <- plugin-tools
protocol <- preferences <- storage
protocol <- shared <- runtime-node
plugin-package + runtime-node + shared + storage
  -> plugin-management-node
  -> CLI/Desktop
```

Rules for dependency changes:

1. Public plugin author types belong in `@tooldeck/sdk-node`, not in private runtime packages.
2. `@tooldeck/sdk-node` must not depend on `@tooldeck/runtime-node`, `@tooldeck/host-node`, Electron, React, SQLite, or storage.
3. `@tooldeck/runtime-node` may depend on `@tooldeck/sdk-node` for the shared Node plugin contract, but it must not depend on Electron UI or React.
4. `@tooldeck/protocol` must remain data-only and standards-facing. Do not add function-based Node SDK APIs such as `CommandHandler`, `PluginContext`, or `Disposable` there.
5. `@tooldeck/storage` and `@tooldeck/preferences` are product implementation packages, not TPP protocol packages.
6. `@tooldeck/plugin-package` owns the package format but does not scan, activate, install, persist, or render plugins.
7. `@tooldeck/plugin-management-node` may coordinate package, runtime scan, storage, and filesystem services, but apps retain CLI formatting, Electron IPC, and renderer interaction.
8. `@tooldeck/plugin-tools` may depend on public authoring packages, but it must not expose private product packages through its published API.
9. Published public packages must not leak private package dependencies through `dependencies` or generated `.d.ts` files.
10. Before publishing SDK or authoring packages, inspect packed tarballs if dependency boundaries changed.

## Architecture Rules

Follow these constraints:

1. `packages/protocol` must not depend on Electron, React, SQLite, Node plugin runtime, or UI code.
2. `packages/runtime-node` must not depend on Electron UI or React.
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

## Command Execution

All `pnpm` commands must be run with elevated privileges from the first attempt.

Preserve the pnpm store configuration supplied by the execution environment. Do not add,
remove, replace, or override an injected `--store-dir` argument. In particular, do not
work around dependency or network failures by switching the repository to a different
pnpm store.

## Temporary Files

Delete temporary files and directories created by the agent as soon as they are no
longer needed. This includes unpacked archives, package-inspection directories, generated
test projects, and copied fixtures. Use cleanup paths that also run after failures, and
verify agent-owned temporary content is gone before handoff.

Do not delete temporary or staging content that predates the task or whose ownership is
unclear. Product-managed `.staging` entries reported through `cleanupPending` are
diagnostic state, not agent-owned temporary files.

## Git Branch Names

When creating a branch, use:

```text
<type>/<version>-<kebab-case-name>
```

Examples:

```text
docs/1.3-user-agent-docs
fix/1.3-install-cleanup
test/1.3-plugin-lifecycle
```

Use a Conventional Commit type, the target release version, and a short lowercase
kebab-case name. Do not use or prepend the default `codex/` branch prefix.

## Release Verification

The complete 1.3 repository verification set is:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm check:desktop-boundaries
pnpm smoke:cli
```

Release acceptance also includes building and staging built-in plugins, exercising an
external plugin through build -> pack -> install -> run, checking Desktop drag-and-drop
installation, verifying disable -> failed run -> enable -> successful run, and verifying
uninstall and purge behavior. Run checks in proportion to the change; documentation-only
changes do not require every build or runtime smoke test.

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
