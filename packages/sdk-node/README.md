# @tooldeck/sdk-node

Runtime SDK for Tooldeck Node plugins.

Use this package inside plugin runtime code to define a plugin, register command handlers,
access `PluginContext`, and return structured command results.

## Install

```bash
pnpm add @tooldeck/sdk-node
```

Most plugin projects should also install the authoring tools:

```bash
pnpm add -D @tooldeck/plugin-tools @tooldeck/vite-plugin
```

## Define a Plugin

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>((plugin) => {
  plugin.command("hello.world", async (input) => {
    return okText(`Hello ${input.text}`);
  });
});
```

`PluginCommandInputs` should be generated from `manifest.json` with
`tooldeck-plugin generate`.

## Result Helpers

Commands return `CommandResult` values made of `ContentBlock` blocks:

```ts
import { codeBlock, failText, jsonBlock, ok, okText, propertiesBlock } from "@tooldeck/sdk-node";

return okText("Done");
return ok([jsonBlock({ ok: true })]);
return failText("ERR_INVALID_INPUT", "Invalid input.", "Invalid input.");
```

Available block helpers:

- `textBlock(text)`
- `codeBlock(text, language?)`
- `jsonBlock(value)`
- `propertiesBlock(items)`

Available result helpers:

- `ok(blocks)`
- `okText(text)`
- `fail(code, message, blocks?)`
- `failText(code, message, text?)`

## Plugin Context

`PluginContext` exposes plugin-scoped capabilities such as command registration,
subscriptions, and storage. Storage is scoped to the current plugin id.

```ts
export default definePlugin<PluginCommandInputs>({
  async onActivate(ctx) {
    await ctx.storage.set("activated", true);
  },
  commands: {
    "hello.world": async (input) => okText(input.text),
  },
});
```

Registration APIs return `Disposable`. When you use the builder or object-style
`commands` form, the SDK records command registrations in `ctx.subscriptions`.

## Scope

This package is runtime-only. It does not generate files, validate plugin projects, or
bundle runtime code. Use `@tooldeck/plugin-tools` and `@tooldeck/vite-plugin` for those
development-time tasks.
