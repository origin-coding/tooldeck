# @tooldeck/cli

Command-line interface for Tooldeck.

The CLI scans trusted local plugin manifests, lists available commands, runs commands
through the shared runtime-node path, and records command run history in SQLite.

## Development

From the workspace root:

```bash
pnpm --filter @tooldeck/cli dev -- list commands
pnpm --filter @tooldeck/cli dev -- run json.format --text '{"a":1}'
```

Root aliases:

```bash
pnpm dev:cli -- list commands
pnpm dev:cli -- run json.format --text '{"a":1}'
```

## Commands

```bash
tooldeck list commands
tooldeck list plugins
tooldeck list preferences
tooldeck run <command-id> [command input flags]
tooldeck plugin install <package.tdplugin>
tooldeck plugin uninstall <plugin-id>
tooldeck plugin purge <plugin-id>
tooldeck plugin list
tooldeck plugin enable <plugin-id>
tooldeck plugin disable <plugin-id>
tooldeck preference list
tooldeck paths
```

`list` defaults to `commands` when no resource is provided.

`plugin install` accepts trusted local `.tdplugin` packages and installs them into Tooldeck's
managed installed-plugin directory. `plugin uninstall` removes only managed installs; plugin
state, plugin-scoped KV, and command history are preserved. `plugin purge` requires the plugin to
be uninstalled, deletes its retained state and plugin-scoped KV, and preserves command history.
Plugin list output includes each plugin's `builtin`, `installed`, or `external` source.

## External Plugin Dirs

Use `--plugin-dir` to scan additional trusted local plugin projects or plugin collection
directories:

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin --text "hello"
```

`--plugin-dir` can be provided more than once. Built-in plugins are still scanned from the
resolved built-in plugin directory unless `--plugins` overrides that path.

## Storage

Use `--storage <path>` to point CLI state at a specific SQLite database:

```bash
tooldeck run json.format --storage ./tooldeck.sqlite --text '{"a":1}'
```

Command runs are recorded unless the CLI command history preference disables recording.

## Build and Test

```bash
pnpm --filter @tooldeck/cli build
pnpm --filter @tooldeck/cli test
pnpm --filter @tooldeck/cli typecheck
pnpm --filter @tooldeck/cli smoke:built
```
