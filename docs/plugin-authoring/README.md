# Tooldeck Plugin Authoring

This guide covers the current Tooldeck 1.4 plugin authoring and local distribution path:
trusted, commands-only Node plugins built outside the Tooldeck monorepo.

Tooldeck plugins are manifest-first:

```text
manifest.json -> generated command types -> Node command handlers -> dist/index.js
  -> .tdplugin package -> local installation -> lazy activation
```

The manifest is a static capability declaration. Tooldeck scans it without importing or
executing plugin code. Runtime code is loaded only when a matching command is run.

## Create a Plugin

Use the official project generator:

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin
cd my-tooldeck-plugin
pnpm install
pnpm check
pnpm build
pnpm exec tooldeck-plugin pack
```

The generated project uses:

- `@tooldeck/sdk-node` for `definePlugin`, `PluginContext`, and result helpers.
- `@tooldeck/plugin-tools` for type generation, checks, builds, diagnostics, and tests.
- `@tooldeck/vite-plugin` for Node plugin bundling.

## Project Shape

The default `plugin-node-vite` template creates a minimal project like this:

```text
my-tooldeck-plugin/
  manifest.json
  package.json
  tsconfig.json
  vite.config.ts
  locales/
    en.json
  src/
    index.ts
    generated/
      commands.ts
  test/
    plugin.test.ts
```

`src/generated/commands.ts` is generated from `manifest.json`; do not edit it by hand.

## Manifest Basics

A commands-only Node plugin declares its runtime and commands in `manifest.json`:

```json
{
  "schemaVersion": "1.0",
  "id": "dev.example.my-tooldeck-plugin",
  "name": {
    "key": "plugin.name",
    "default": "My Tooldeck Plugin"
  },
  "version": "0.0.0",
  "runtime": {
    "kind": "node",
    "entry": "./dist/index.js"
  },
  "defaultLocale": "en",
  "locales": {
    "en": "./locales/en.json"
  },
  "contributes": {
    "commands": [
      {
        "id": "hello.world",
        "title": {
          "key": "commands.hello.title",
          "default": "Hello World"
        },
        "inputSchema": {
          "type": "object",
          "required": ["text"],
          "additionalProperties": false,
          "properties": {
            "text": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      }
    ]
  }
}
```

Use `LocalizedString` objects (`key` plus `default`) for protocol-facing display text.
JSON Schema should stay standards-compatible; Tooldeck-specific extensions use `x-i18n`
and `x-ui`.

## Command Schema Profiles

Tooldeck commands use two deliberately bounded JSON Schema Draft-07 profiles. These are
Draft-07 subsets, not support for the complete Draft-07 vocabulary:

- `command-input-v1` describes a complete command input object. It supports object,
  array, scalar, and direct boolean property schemas; `properties`, `required`,
  `additionalProperties`, single-schema `items`, and object-schema `allOf`; `enum`,
  `const`, and `default`; numeric, string, array, and object limits; annotations; and the
  documented `x-i18n`, `x-ui`, and `x-enumLabels` authoring extensions. The root must be
  an object schema, and each `type` must be one standard scalar value rather than an
  array of types.
- `command-output-v1` optionally constrains the complete normalized `CommandResult`. It
  supports the same core object, array, scalar, boolean-property, constraint, and
  annotation families, but does not support `default`, input UI/localization extensions,
  coercion, or output mutation. Its root must also have `type: "object"`.

`outputSchema` is optional. Tooldeck always validates a handler result against the base
`CommandResult` and `ContentBlock` contract first. When `outputSchema` is declared,
Tooldeck applies it afterward as an additional plugin-specific contract; it does not
replace the base validation.

Neither profile supports full Draft-07, `$ref` (including local references), remote or
file schema loading, `format`, `ajv-formats`, or executable custom keywords. Composition
and conditional keywords such as `oneOf`, `anyOf`, `not`, and `if` / `then` / `else` are
also outside the profiles. Use the canonical profile schemas in `@tooldeck/protocol` as
the exact source of supported keywords and structural forms.

Unsupported or invalid command schemas fail before command execution. The official
`generate`, `check`, `build`, `inspect`, `pack`, and `dist` workflows reject them, as do
`.tdplugin` package validation and runtime manifest scanning. Profile checks and schema
compilation operate only on static manifest data: they do not import, load, or activate
plugin runtime code.

### Tooldeck 1.4 Compatibility

Manifest files and `.tdplugin` packages within the Tooldeck 1.3 officially documented
and tool-validated range remain supported. Ajv capabilities that the 1.3 runtime happened
to accept, but that the 1.3 authoring tools and documentation did not support, were
implementation overreach and are not part of the compatibility promise. In particular,
plugins must not rely on full Draft-07, references, remote resolution, formats, or
executable custom keywords. Tooldeck 1.4 rejects those constructs earlier and does not
introduce a new manifest `schemaVersion` for this clarification.

## Runtime Code

Use generated input types with `definePlugin`:

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>((plugin) => {
  plugin.command("hello.world", async (input) => {
    return okText(`Hello ${input.text}`);
  });
});
```

Commands return structured `CommandResult` values with `ContentBlock` blocks. They do not
return React, Vue, HTML, or UI components.

## Development Commands

Generated plugins include the standard scripts:

```bash
pnpm generate
pnpm check
pnpm build
pnpm test
pnpm inspect
pnpm exec tooldeck-plugin pack
pnpm exec tooldeck-plugin dist
```

The underlying `tooldeck-plugin` commands are:

```bash
tooldeck-plugin generate
tooldeck-plugin generate types --manifest manifest.json --out src/generated/commands.ts
tooldeck-plugin check --manifest manifest.json --generated src/generated/commands.ts
tooldeck-plugin build --bundler vite
tooldeck-plugin check --built
tooldeck-plugin pack
tooldeck-plugin dist
tooldeck-plugin inspect
```

`pack` validates the project and built runtime before creating a package. `dist` runs the
supported build path and then packages the result.

## Package a Plugin

After building, create a local installation package:

```bash
pnpm exec tooldeck-plugin pack
```

The default output name is:

```text
<plugin-id>-<manifest-version>.tdplugin
```

Build and package in one command, or select an output path:

```bash
pnpm exec tooldeck-plugin dist
pnpm exec tooldeck-plugin pack --output ./release/my-plugin.tdplugin
pnpm exec tooldeck-plugin dist --output ./release/my-plugin.tdplugin
```

`--output` changes only the archive path and filename; it does not change the identities
or versions stored in `manifest.json` or `tooldeck-package.json`.

A package contains root `manifest.json`, generated root `tooldeck-package.json`, the
declared runtime entry and locale files, and regular files under `dist/` and `assets/`
when those directories exist. It must not contain `node_modules`. Tooldeck validates
archive paths, package metadata, file counts, compressed and uncompressed size limits,
and the declared runtime entry before installation.

`.tdplugin` is a ZIP-based Tooldeck product package format, not a new TPP capability
declaration. The manifest remains the static source of plugin identity and capabilities.

## Verify with the CLI

From the Tooldeck workspace, point the CLI at the external plugin directory:

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin --text "Tooldeck"
```

`--plugin-dir` accepts trusted local plugin projects or collection directories. It can be
provided more than once.

## Verify with Desktop

Run Desktop with the same external plugin directory:

```bash
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

You can also set multiple directories through `TOOLDECK_PLUGIN_DIRS` using the platform
path delimiter.

## Install the Packaged Plugin

Use the CLI for the full local distribution check:

```bash
tooldeck plugin install ./dev.example.my-tooldeck-plugin-0.0.0.tdplugin
tooldeck plugin list
tooldeck run hello.world --text "Tooldeck"
tooldeck plugin disable dev.example.my-tooldeck-plugin
tooldeck plugin enable dev.example.my-tooldeck-plugin
tooldeck plugin uninstall dev.example.my-tooldeck-plugin
tooldeck plugin purge dev.example.my-tooldeck-plugin
```

The Desktop Plugins workbench also accepts one `.tdplugin` file by drag and drop.

Installation, catalog scanning, enable/disable, uninstall, and purge do not import or
activate plugin runtime code. Runtime activation remains lazy and occurs only when a
matching command is invoked.

## Built-in, Installed, and External Plugins

Built-in plugins are discovered from Tooldeck's resolved built-in plugin directory.
Installed plugins come from `.tdplugin` files copied into Tooldeck's managed user-level
installed plugin directory. They are scanned by default alongside built-in plugins.
External plugins are included only through explicit development inputs such as
`--plugin-dir` or `TOOLDECK_PLUGIN_DIRS`.

Duplicate plugin ids and command ids are rejected across all three sources; no source
overrides another. `--plugin-dir` is a development-time incremental source and does not
install or copy the plugin.

Tooldeck 1.4 supports trusted local installation packages. It does not provide remote
installation, a remote registry, marketplace discovery, signing, hot reload, dependency
resolution, or an untrusted plugin sandbox.

## References

- [TPP v1](../architecture/tpp-v1.md)
- [V1 Scope](../architecture/v1-scope.md)
- [ADR 0008: TPP v1 Command Input Schema Profile](../architecture/decisions/0008-tpp-v1-command-input-schema-profile.md)
- [ADR #71: Shared JSON Schema Execution Ownership](https://github.com/origin-coding/tooldeck/issues/71)
- [ADR #74: TPP v1 Command Output Schema Profile](https://github.com/origin-coding/tooldeck/issues/74)
- [Tooldeck 1.2 Planning](../planning/1.2.md)
- [Tooldeck 1.3 Planning and Implementation Status](../planning/1.3.md)
- [CLI plugin authoring notes](./cli-plugin.md)
