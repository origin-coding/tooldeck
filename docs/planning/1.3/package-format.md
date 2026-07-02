# Package Format

本文定义 Tooldeck 1.3 中 `.tdplugin` 本地插件安装包格式。该格式是 Tooldeck 产品层的插件包容器，不属于 TPP 核心协议。

## 定位

`.tdplugin` 用于可信本地插件分发：

```text
plugin project
  -> tooldeck-plugin pack
  -> .tdplugin
  -> tooldeck plugin install
```

TPP manifest 继续描述插件能力；`.tdplugin` 只描述“这些能力和运行时产物如何作为一个本地安装包交付”。

## 文件扩展名

1.3 使用：

```text
.tdplugin
```

示例：

```text
dev.example.my-plugin-0.1.0.tdplugin
```

产物命名规则：

```text
<plugin-id>-<version>.tdplugin
```

`tooldeck-plugin pack` 和 `tooldeck-plugin dist` 可通过 `--output <file>` 覆盖输出文件路径。该参数只影响容器文件写入位置和文件名，不影响包内 `manifest.json` 或 `tooldeck-package.json` metadata。

1.3 不支持 `{name}` / `{version}` 等文件名占位符模板，也不从 `package.json.name` 或 manifest display name 派生产物文件名。

## 容器格式

`.tdplugin` 本质是 zip 容器。1.3 需要把 zip 作为 Tooldeck package format 的实现约定记录在文档中，但不把 zip 写入 TPP 核心协议。

包内根目录必须包含：

```text
manifest.json
tooldeck-package.json
```

常见包结构：

```text
manifest.json
tooldeck-package.json
dist/
  index.js
locales/
  en.json
  zh-CN.json
```

## `manifest.json`

`manifest.json` 继续是插件能力的权威声明：

- plugin id
- name / description
- version
- runtime kind / entry
- contributes.commands
- locales
- permissions declaration

1.3 不把 package metadata 写入 `manifest.json`。原因：

- package metadata 描述一次打包产物，不是插件能力。
- digest、文件清单、打包时间等信息属于包容器或安装状态。
- TPP 核心协议应保持 runtime-agnostic 和能力声明导向。

## `tooldeck-package.json`

`tooldeck-package.json` 描述包容器本身。

1.3 最小字段：

```json
{
  "formatVersion": "1.0",
  "manifestPath": "manifest.json",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "files": [
    "manifest.json",
    "tooldeck-package.json",
    "dist/index.js",
    "locales/en.json"
  ]
}
```

字段语义：

| 字段              | 说明                                    |
|-----------------|---------------------------------------|
| `formatVersion` | Tooldeck package format version。      |
| `manifestPath`  | 包内 TPP manifest 路径，1.3 固定为根 manifest。 |
| `createdAt`     | 包生成时间，使用 ISO 8601 字符串。                |
| `files`         | 包内所有普通文件的相对路径列表。                      |

## 文件清单规则

`files` 必须列出包内所有普通文件。安装器应校验：

- zip entries 中的普通文件都出现在 `files` 中。
- `files` 中声明的文件都实际存在。
- 路径使用包内相对路径。
- 不允许绝对路径。
- 不允许 `..` 路径穿越。
- 不允许 `node_modules`。

`files` 不记录目录；目录由文件路径隐式表达。

## Runtime-agnostic 约定

`.tdplugin` 应可被未来不同 runtime 复用：

```text
runtime.kind = node
runtime.kind = wasm
runtime.kind = process
```

1.3 只实现 `runtime.kind: "node"` 的安装校验和运行。包格式本身不命名为 Node package，也不把 Node 专属字段放入 `tooldeck-package.json`。

runtime-specific 校验由安装流程根据 `manifest.runtime.kind` 分派：

```text
read package
  -> read manifest
  -> inspect runtime.kind
  -> run runtime-specific install validation
```

## 禁止内容

1.3 包内禁止：

- `node_modules`
- 绝对路径 entries
- 路径穿越 entries
- symlink escape
- package digest 自证字段
- signature
- install path
- permission approval state
- user-specific settings
- plugin KV

digest、install path、permission approval state 等信息属于本机安装状态，应由 storage 记录。

## 非目标

1.3 package format 不包含：

- marketplace metadata。
- remote registry metadata。
- signature manifest。
- integrity manifest。
- dependency manifest。
- license/readme 强制要求。

这些能力可以在后续版本通过显式格式扩展加入。

## 验收标准

- `.tdplugin` 包可以被 `@tooldeck/plugin-packages` 读取。
- root `manifest.json` 缺失时校验失败。
- root `tooldeck-package.json` 缺失时校验失败。
- `files` 与实际 zip entries 不一致时校验失败。
- 包内存在 `node_modules` 时校验失败。
- 包内存在路径穿越或绝对路径时校验失败。
