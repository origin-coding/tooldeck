# @tooldeck/vite-plugin

Vite integration for Tooldeck Node plugins.

The plugin configures Vite to build a trusted local Tooldeck plugin runtime entry as a
single ESM file that can be loaded by the Tooldeck Node plugin host.

## Install

```bash
pnpm add -D @tooldeck/vite-plugin vite typescript
```

## Usage

```ts
import { defineConfig } from "vite";
import { tooldeckPlugin } from "@tooldeck/vite-plugin";

export default defineConfig({
  plugins: [tooldeckPlugin()],
});
```

Default build conventions:

- Manifest path: `manifest.json`
- Source entry: `src/index.ts`
- Output directory: `dist`
- Output file: `index.js`
- Vite target: `node22`
- Format: ESM
- Sourcemap: enabled
- Minify: disabled

With defaults, the plugin manifest must declare:

```json
{
  "runtime": {
    "kind": "node",
    "entry": "./dist/index.js"
  }
}
```

## Options

```ts
tooldeckPlugin({
  manifest: "manifest.json",
  entry: "src/index.ts",
  outDir: "dist",
  outputFile: "index.js",
  target: "node22",
  sourcemap: true,
  minify: false
});
```

The plugin validates `runtime.kind` and `runtime.entry` during build startup. If you
change `outDir` or `outputFile`, update `manifest.runtime.entry` to match.

## External Policy

Node built-in modules, including `node:*` imports, are left external. Other dependencies
are bundled through Vite's SSR build path.

## Scope

`@tooldeck/vite-plugin` only provides build integration. It does not replace
`tooldeck-plugin check`; use `@tooldeck/plugin-tools` to validate manifests, generated
types, and built output.
