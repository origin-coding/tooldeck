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
tooldeck preference get <key>
tooldeck preference set <key> <json-value>
tooldeck preference delete <key>
tooldeck paths
```

`list` defaults to `commands` when no resource is provided.

`plugin install` accepts trusted local `.tdplugin` packages and installs them into Tooldeck's
managed installed-plugin directory. `plugin uninstall` removes only managed installs; plugin
state, plugin-scoped KV, and command history are preserved. `plugin purge` requires the plugin to
be uninstalled, deletes its retained state and plugin-scoped KV, and preserves command history.
Plugin list output includes each plugin's `builtin`, `installed`, or `external` source.

## Local Plugin Lifecycle

Install a package created by `tooldeck-plugin pack` or `tooldeck-plugin dist`:

```bash
tooldeck plugin install ./dev.example.my-plugin-0.1.0.tdplugin
tooldeck plugin list
tooldeck run my.command
```

Tooldeck accepts trusted local `.tdplugin` files only. Installation validates the archive,
package metadata, manifest, runtime entry, package limits, and conflicts without importing
or activating plugin runtime code.

Disable and re-enable a plugin:

```bash
tooldeck plugin disable dev.example.my-plugin
tooldeck run my.command
tooldeck plugin enable dev.example.my-plugin
tooldeck run my.command
```

A disabled plugin and its commands remain visible, but command execution is blocked and
recorded as an error run when command history is enabled.

Uninstall and optionally remove retained local data:

```bash
tooldeck plugin uninstall dev.example.my-plugin
tooldeck plugin purge dev.example.my-plugin
```

`uninstall` applies only to Tooldeck-managed installed plugins. It removes installed
files and the install record while preserving plugin state, plugin-scoped KV, and command
history. `purge` requires the plugin to be uninstalled; it removes retained plugin state
and plugin-scoped KV while preserving command history.

If uninstall reports that cleanup is pending, the plugin is already logically
uninstalled but a quarantined directory could not be removed. The diagnostic includes
the cleanup failure instead of restoring a partially removed plugin as active.

## Plugin Sources

The default scan order is:

```text
builtin -> installed
```

Each `--plugin-dir` adds an explicit development source after the defaults:

```text
builtin -> installed -> external
```

Duplicate plugin ids and command ids are errors; sources never override one another.

## External Plugin Dirs

Use `--plugin-dir` to scan additional trusted local plugin projects or plugin collection
directories:

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin --text "hello"
```

`--plugin-dir` can be provided more than once. Built-in plugins are still scanned from the
resolved built-in plugin directory unless `--plugins` overrides that path.

`--plugins` is a built-in plugin root override used by development and tests. It does not
replace the installed source. Prefer `--plugin-dir` when verifying an external plugin
project.

## Storage

Use `--storage <path>` to point CLI state at a specific SQLite database:

```bash
tooldeck run json.format --storage ./tooldeck.sqlite --text '{"a":1}'
```

Command runs are recorded unless the CLI command history preference disables recording.

Use `tooldeck paths` to inspect all resolved locations, including the database, installed
plugins, plugin data, cache, logs, and temporary directory.

## Preferences and Output

Known CLI-facing preferences include:

```text
output.format             "text" | "json"
command.history.enabled   true | false
locale                    "system" | "en-US" | "zh-CN"
```

Preference values are JSON, so strings must include JSON quotes:

```bash
tooldeck preference set output.format '"json"'
tooldeck preference set command.history.enabled false
tooldeck preference get output.format
tooldeck preference delete output.format
```

`tooldeck list preferences` and `tooldeck preference list` both show known preferences.
The configured output format also applies to plugin and preference operation output.

Commands that return a `status: "error"` result set a non-zero process exit code even when
the plugin did not throw an exception.

## Build and Test

```bash
pnpm --filter @tooldeck/cli build
pnpm --filter @tooldeck/cli test
pnpm --filter @tooldeck/cli typecheck
pnpm --filter @tooldeck/cli smoke:built
```
