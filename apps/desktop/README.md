# @tooldeck/desktop

Electron desktop app for Tooldeck.

The desktop app provides the renderer UI while the main process owns plugin scanning,
runtime execution, and SQLite access. Renderer code talks to the main process through the
preload/API boundary and does not import plugin runtime code or access SQLite directly.

The Plugins workbench installs trusted local `.tdplugin` packages, uninstalls managed plugins,
and lists local state or plugin-scoped KV retained after uninstall. Purging retained data is a
separate confirmed action and never deletes command history.

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
