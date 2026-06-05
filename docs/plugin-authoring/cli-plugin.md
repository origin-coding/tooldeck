# CLI 插件作者指南

状态：待整理的早期作者指南。本文仍可作为 commands-only 本地插件写法参考，但当前 V1 已扩展到 Desktop + CLI 共享同一套可信本地插件模型；后续应改写为“本地插件作者指南”。当前 V1 范围以 [TPP V1 Scope](../architecture/v1-scope.md) 为准。

本文覆盖当前可信本地插件 MVP 的 SDK 写法。当前阶段只支持
commands-only 插件：插件在 `manifest.json` 静态声明 commands，通过 SDK
注册 command handler，返回结构化 `ContentBlock` 结果，并能被 Tooldeck CLI
运行。

`plugins/json-tools` 是当前推荐参考实现。

## 最小插件结构

一个本地 CLI 插件至少需要 manifest、TypeScript 入口文件，以及从 manifest
生成的 command input 类型文件：

```text
plugins/my-tools/
  manifest.json
  package.json
  tsconfig.json
  src/
    index.ts
    generated/
      commands.ts
```

Manifest 是静态声明。Tooldeck 扫描 manifest 时只读取插件能力列表，不 import
也不执行插件代码。只有运行某个匹配 command 时，Node 插件入口才会被加载。

## Commands-Only Manifest

MVP manifest schema 只接受 command contributions。当前阶段不要在 manifest
里加入 documents、tables、views、menus、settings、permissions 或
activation events。

```json
{
  "$schema": "../../packages/protocol/schema/manifest-v1.schema.json",
  "schemaVersion": "1.0",
  "id": "dev.example.my-tools",
  "name": {
    "key": "plugin.name",
    "default": "My Tools"
  },
  "description": {
    "key": "plugin.description",
    "default": "Small CLI tools for Tooldeck."
  },
  "version": "0.0.0",
  "runtime": {
    "kind": "node",
    "entry": "./dist/index.js"
  },
  "defaultLocale": "en",
  "locales": {
    "en": "./locales/en.json",
    "zh-CN": "./locales/zh-CN.json"
  },
  "contributes": {
    "commands": [
      {
        "id": "my.echo",
        "title": {
          "key": "commands.echo.title",
          "default": "Echo Text"
        },
        "description": {
          "key": "commands.echo.description",
          "default": "Return the provided text."
        },
        "inputSchema": {
          "type": "object",
          "required": ["text"],
          "additionalProperties": false,
          "properties": {
            "text": {
              "type": "string",
              "title": "Text",
              "minLength": 1,
              "x-i18n": {
                "title": "schema.echo.text.title"
              }
            }
          }
        }
      }
    ]
  }
}
```

插件 ID 和 command ID 都使用小写、点分隔命名。协议面对用户展示的文本优先用
`LocalizedString` 对象，也就是 `key` 加 `default`。

`inputSchema` 是运行时输入契约。CLI 会把 flags 解析成 command input，core 再
根据 manifest schema 校验和规范化输入，然后才调用 handler。

## 从 Manifest 生成输入类型

不要在插件代码里手写 command input 类型。既然 manifest 已经声明了
`inputSchema`，就从 manifest 生成类型，避免编译期类型和运行时校验不一致。

参考 `plugins/json-tools/package.json` 添加脚本：

```json
{
  "scripts": {
    "generate:types": "pnpm --dir ../.. --filter @tooldeck/plugin-tools build && node ../../packages/plugin-tools/dist/generate-command-types.js manifest.json src/generated/commands.ts",
    "build": "pnpm generate:types && tsc -p tsconfig.json",
    "typecheck": "pnpm generate:types && tsc --noEmit"
  },
  "dependencies": {
    "@tooldeck/plugin-tools": "workspace:*",
    "@tooldeck/sdk-node": "workspace:*"
  }
}
```

上面的 `my.echo` manifest 会生成类似文件：

```ts
// This file is generated from manifest.json. Do not edit it by hand.

export interface MyEchoInput {
  text: string;
}

export interface PluginCommandInputs {
  "my.echo": MyEchoInput;
}
```

当前生成器支持 MVP 使用到的 JSON Schema 子集：object、required properties、
primitive values、array、nested object、enum 和 `additionalProperties`。

## 推荐的 `definePlugin()` 写法

新插件优先使用 builder 写法。它足够简洁，也能使用生成出来的 command input
类型：

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>((plugin) => {
  plugin.command("my.echo", async (input) => {
    return okText(input.text);
  });
});
```

Builder 会在插件激活时自动注册 command，并把 `ctx.commands.register()` 返回的
`Disposable` 放进 `ctx.subscriptions`。

如果你更喜欢 command map 加生命周期 hook，可以使用对象写法：

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>({
  commands: {
    "my.echo": async (input) => okText(input.text),
  },

  async onActivate(ctx) {
    await ctx.storage.set("lastActivatedAt", new Date().toISOString());
  },
});
```

只有在需要直接控制注册或清理时，才使用底层 `activate(ctx)` 写法：

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>({
  activate(ctx) {
    ctx.subscriptions.push(ctx.commands.register("my.echo", async (input) => okText(input.text)));
  },
});
```

如果你手动调用 `ctx.commands.register()`，一定要把返回的 `Disposable` 放进
`ctx.subscriptions`。插件停用时，host 会释放这些 subscriptions。

## Command Result Helper

Command 返回结构化结果，不返回 UI 组件。当前 MVP 支持的 `ContentBlock` 是
`text` block。

普通文本成功结果使用 `okText()`：

```ts
import { okText } from "@tooldeck/sdk-node";

return okText("Done");
```

可预期的 command 失败使用 `failText()`：

```ts
import { failText } from "@tooldeck/sdk-node";

return failText("ERR_INVALID_INPUT", "Text is required.", "Text is required.");
```

`failText(code, message, text)` 会返回 `status: "error"`，填充
`error.code` 和 `error.message`，并可选附带一个用于 CLI 输出的 text block。

## Plugin-Scoped KV Storage

`ctx.storage` 按当前插件 ID 隔离。插件只能通过 SDK API 读写自己的 key：

```ts
await ctx.storage.get("key");
await ctx.storage.set("key", value);
await ctx.storage.delete("key");
```

Command handler 当前只接收 `input`。如果 handler 需要访问 storage，使用底层
`activate(ctx)` 写法，并让 handler 闭包捕获 `ctx`：

```ts
import { definePlugin, okText } from "@tooldeck/sdk-node";

import type { PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>({
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register("my.echo", async (input) => {
        const count = Number((await ctx.storage.get("echoCount")) ?? 0) + 1;

        await ctx.storage.set("echoCount", count);

        return okText(`${input.text}\nrun count: ${count}`);
      }),
    );
  },
});
```

KV value 必须可 JSON 序列化。CLI host 会把这些值作为 plugin scoped KV
持久化到 SQLite。

## 构建和运行

Manifest 的 runtime entry 指向 `./dist/index.js`，所以运行前需要先构建插件：

```bash
pnpm --filter @tooldeck/my-tools build
```

从 workspace root 列出并运行 command：

```bash
pnpm --filter @tooldeck/cli dev -- list commands
pnpm --filter @tooldeck/cli dev -- run my.echo --text "hello"
```

`plugins/json-tools` 是当前 canonical smoke test：

```bash
pnpm --filter @tooldeck/cli dev -- run json.format --text "{\"a\":1}"
```

预期结果是 CLI 打印结构化 command result 里的 text block，同时 SQLite 写入一条
command run history。
