# @tooldeck/create-plugin

Create a Tooldeck plugin project from the official local templates.

The current template creates a commands-only Node + TypeScript + Vite plugin that uses
`@tooldeck/sdk-node`, `@tooldeck/plugin-tools`, and `@tooldeck/vite-plugin`.

## Usage

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin
```

Non-interactive usage:

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin \
  --yes \
  --plugin-id dev.example.my-tooldeck-plugin \
  --plugin-name "My Tooldeck Plugin" \
  --command-id hello.world
```

Supported options:

- `--name <name>` sets the project directory name.
- `--plugin-id <id>` sets the manifest plugin id.
- `--plugin-name <name>` sets the display name.
- `--command-id <id>` sets the example command id.
- `--template <name>` selects a template. V1.2 supports `plugin-node-vite`.
- `--install` installs dependencies after scaffolding.
- `--no-install` skips dependency installation.
- `--yes` disables prompts and uses provided/default values.

The package also exposes the `create-plugin` binary alias.

## Generated Structure

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

## Next Steps

```bash
cd my-tooldeck-plugin
pnpm install
pnpm check
pnpm build
pnpm test
```

## Verify from a Tooldeck Workspace

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin --text "hello"
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

Replace `hello.world` with the command id generated for your project.

## V1.2 Scope

The generated project is a trusted local plugin project. Tooldeck V1.2 does not include
plugin installation packages, marketplace publishing, a remote registry, plugin hot
reload, or an untrusted plugin sandbox.
