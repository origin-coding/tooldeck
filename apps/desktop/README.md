# @tooldeck/desktop

Electron desktop app for Tooldeck.

The desktop app provides the renderer UI while the main process owns plugin scanning,
runtime execution, and SQLite access. Renderer code talks to the main process through the
preload/API boundary and does not import plugin runtime code or access SQLite directly.

The Plugins workbench installs trusted local `.tdplugin` packages, uninstalls managed plugins,
and lists local state or plugin-scoped KV retained after uninstall. Purging retained data is a
separate confirmed action and never deletes command history.

## Using the Desktop App

The sidebar can browse plugins first or commands first. Select a command to fill its
manifest-defined input form, run it, and inspect structured text, code, JSON, or properties
output. Successful and failed runs appear in Command History.

Open the Plugins workbench to manage local plugins:

1. Drag exactly one `.tdplugin` file into the install drop zone. The current surface is
   drag-only; clicking it does not open a file picker.
2. Wait for installation and catalog refresh to complete.
3. Select the installed plugin to inspect its source, version, runtime state, contributed
   commands, and manifest path.
4. Use Enable or Disable to change whether its commands can run.
5. Use Uninstall for a Tooldeck-managed installed plugin. Built-in and external plugins
   cannot be uninstalled from Tooldeck.
6. Use Purge in the retained-data section after uninstall to remove plugin state and
   plugin-scoped KV. Command history remains available.

The drop zone rejects empty drops, multiple files, and files without the `.tdplugin`
extension. Tooldeck validates and installs packages in the main process; the renderer does
not receive a general-purpose local filesystem path API.

The Settings workbench provides Simplified Chinese, English, and system locale options,
plugin-first or command-first navigation, sidebar collapse state, catalog rescan, and a
summary of local plugins, commands, and recent runs.

All local plugins are trusted code. Manifest scanning, installation, uninstall, and catalog
refresh do not activate plugin runtime code; activation occurs only when a matching command
is invoked.

## Development

From the workspace root:

```bash
pnpm --filter @tooldeck/desktop dev
```

Root alias:

```bash
pnpm dev:desktop
```

## External Plugin Dirs

Run Desktop with one or more trusted local plugin directories:

```bash
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../plugin-a --plugin-dir ../plugin-b
```

You can also use `TOOLDECK_PLUGIN_DIRS`. Separate multiple entries with the platform path
delimiter.

```bash
TOOLDECK_PLUGIN_DIRS=../plugin-a:../plugin-b pnpm --filter @tooldeck/desktop dev
```

On Windows PowerShell:

```powershell
$env:TOOLDECK_PLUGIN_DIRS="..\plugin-a;..\plugin-b"
pnpm --filter @tooldeck/desktop dev
```

## Build and Package

```bash
pnpm --filter @tooldeck/desktop build
pnpm --filter @tooldeck/desktop dist
```

`dist` stages built-in plugins into the Electron resources before packaging.

## Checks

```bash
pnpm --filter @tooldeck/desktop typecheck
pnpm --filter @tooldeck/desktop test
pnpm --filter @tooldeck/desktop check:boundaries
```

`check:boundaries` guards the V1 architecture rule that renderer code must not access
SQLite or execute plugin code directly.
