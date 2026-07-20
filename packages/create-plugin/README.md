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
- `--template <name>` selects a template. The current release supports `plugin-node-vite`.
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
pnpm exec tooldeck-plugin pack
```

## Verify from a Tooldeck Workspace

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin --text "hello"
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

Replace `hello.world` with the command id generated for your project.

## Package and Install

Create a `.tdplugin` package after building, or build and package in one command:

```bash
pnpm exec tooldeck-plugin pack
pnpm exec tooldeck-plugin dist
```

The default package name is `<plugin-id>-<version>.tdplugin`. Install it through the
Tooldeck CLI or drag one package into the Desktop Plugins workbench:

```bash
tooldeck plugin install ./dev.example.my-tooldeck-plugin-0.0.0.tdplugin
tooldeck plugin list
tooldeck run hello.world --text "hello"
```

## Tooldeck 1.3 Scope

The generated project is a trusted local plugin project. Tooldeck 1.3 supports local
`.tdplugin` packaging and installation, but does not include marketplace publishing,
remote installation or registry discovery, plugin signing, plugin hot reload, dependency
resolution, or an untrusted plugin sandbox.
