# @tooldeck/plugin-tools

Development tools for Tooldeck plugin projects.

This package is intended for plugin authors. It validates a plugin project, generates
command input types from `manifest.json`, coordinates builds, prints diagnostics, and
provides test helpers. It also creates local `.tdplugin` packages for Tooldeck 1.3.

## Install

```bash
pnpm add -D @tooldeck/plugin-tools
```

## CLI

The package exposes `tooldeck-plugin`:

```bash
tooldeck-plugin generate
tooldeck-plugin generate types --manifest manifest.json --out src/generated/commands.ts
tooldeck-plugin check
tooldeck-plugin build --bundler vite
tooldeck-plugin check --built
tooldeck-plugin pack
tooldeck-plugin dist
tooldeck-plugin inspect
```

Recommended plugin `package.json` scripts:

```json
{
  "scripts": {
    "generate": "tooldeck-plugin generate",
    "check": "tooldeck-plugin check",
    "build": "tooldeck-plugin build --bundler vite",
    "pack:plugin": "tooldeck-plugin pack",
    "dist:plugin": "tooldeck-plugin dist",
    "inspect": "tooldeck-plugin inspect"
  }
}
```

## Commands

`tooldeck-plugin generate` generates project files. Today this defaults to command input
types generated from `manifest.json`.

`tooldeck-plugin check` validates the plugin project structure, manifest, generated
command types, and optionally the built runtime entry:

```bash
tooldeck-plugin check --manifest manifest.json --generated src/generated/commands.ts
tooldeck-plugin check --built
```

`tooldeck-plugin build --bundler vite` runs the supported build path for Node plugins.
Only `vite` is supported in the current commands-only Node workflow.

`tooldeck-plugin pack` checks the project and built runtime, then creates
`<plugin-id>-<version>.tdplugin` in the project directory:

```bash
tooldeck-plugin pack
tooldeck-plugin pack --output ./release/my-plugin.tdplugin
```

`tooldeck-plugin dist` builds with Vite and then creates the same package:

```bash
tooldeck-plugin dist
tooldeck-plugin dist --output ./release/my-plugin.tdplugin
```

Both commands accept `--manifest` and `--generated`; `dist` also accepts
`--bundler vite`. `--output` changes the package destination only and does not modify
package metadata.

`tooldeck-plugin inspect` prints project diagnostics suitable for local debugging or issue
reports.

## Testing Helpers

The `@tooldeck/plugin-tools/testing` export provides helpers for testing plugin command
handlers without launching the Tooldeck desktop app or CLI.

```ts
import { describe, expect, it } from "vitest";
import { createPluginTestHost } from "@tooldeck/plugin-tools/testing";

import plugin from "../src";

describe("plugin", () => {
  it("runs a command", async () => {
    const host = await createPluginTestHost(plugin);
    const result = await host.runCommand("hello.world", { text: "Tooldeck" });

    expect(result.status).toBe("success");

    await host.dispose();
  });
});
```

## API Stability

The CLI commands and `@tooldeck/plugin-tools/testing` are the supported plugin-authoring
surface for Tooldeck 1.3. Lower-level project inspection, build, generation, and packaging
APIs are exported for Tooldeck's own packages and may change while the external plugin
workflow is still settling.

## Related Packages

- `@tooldeck/sdk-node` provides runtime SDK APIs used by plugin code.
- `@tooldeck/plugin-package` provides the `.tdplugin` package format implementation.
- `@tooldeck/vite-plugin` provides the default Vite build integration.
- `@tooldeck/create-plugin` scaffolds a complete plugin project.
