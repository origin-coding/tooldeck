# @tooldeck/json-tools

Built-in Tooldeck plugin for JSON commands.

This plugin is the canonical V1 smoke-test plugin for the trusted local plugin slice:

```text
manifest scan -> command list -> lazy activation -> json.format execution -> ContentBlock output -> SQLite history
```

## Commands

### `json.format`

Formats JSON text with configurable indentation.

Input schema:

- `text` string, required.
- `indent` integer, optional, default `2`, minimum `0`, maximum `8`.

Run from the workspace:

```bash
pnpm --filter @tooldeck/cli dev -- run json.format --text '{"a":1}'
pnpm --filter @tooldeck/cli dev -- run json.format --text '{"a":1}' --indent 4
```

Expected output:

```json
{
  "a": 1
}
```

## Development

```bash
pnpm --filter @tooldeck/json-tools generate
pnpm --filter @tooldeck/json-tools check
pnpm --filter @tooldeck/json-tools build
pnpm --filter @tooldeck/json-tools inspect
```

`src/generated/commands.ts` is generated from `manifest.json`.

## Authoring Reference

Use this plugin as a compact example of:

- Static command declaration in `manifest.json`.
- Localized display text through locale files.
- Generated command input types.
- `@tooldeck/sdk-node` command registration.
- Structured command results instead of UI components.
