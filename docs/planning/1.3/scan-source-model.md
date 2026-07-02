# Scan Source Model

本文定义 Tooldeck 1.3 中插件扫描来源模型的变化。该子任务影响 `packages/runtime-node`、`apps/cli`、`apps/desktop` 和 storage 同步语义。

## 背景

1.2 已经支持：

```text
builtin
external
```

其中 external 是开发期入口，由 `--plugin-dir` 或 Desktop `TOOLDECK_PLUGIN_DIRS` 提供。

1.3 新增用户安装目录后，需要把 installed 插件作为独立扫描来源，而不是把它伪装成 external。

## 来源类型

1.3 扫描来源：

```ts
type PluginScanSourceKind = "builtin" | "installed" | "external";
```

含义：

| 来源          | 含义                                                |
|-------------|---------------------------------------------------|
| `builtin`   | Tooldeck 内置插件。                                    |
| `installed` | 用户安装到 Tooldeck 管理目录的插件。                           |
| `external`  | 开发期通过 `--plugin-dir` 或 `TOOLDECK_PLUGIN_DIRS` 指定。 |

## 默认扫描顺序

不传 external plugin dir：

```text
builtin -> installed
```

传入 external plugin dir：

```text
builtin -> installed -> external
```

该顺序只影响 duplicate 检测和诊断中的 existing / incoming 来源，不引入覆盖规则。

## `--plugin-dir` 语义

`--plugin-dir` 继续沿用 1.2 语义：

```text
额外加入 external scan source
```

它不覆盖 builtin，也不覆盖 installed。

保留该语义的原因：

- 避免破坏 1.2 plugin author workflow。
- external 仍然是开发期显式入口。
- installed 插件应在默认运行路径中可用。

## Missing directory 行为

`installed` source 缺失时：

```text
返回 0 plugin，不报错
```

CLI/Desktop 启动或 install service 可以按需创建 installed plugin directory。

`external` source 缺失时：

```text
报错，并指出具体 external plugin directory
```

这是 1.2 已有行为，1.3 保持。

## Source metadata

`ManifestIndex` 中 indexed plugin 和 indexed command 需要携带来源信息：

```ts
source: {
  kind: PluginScanSourceKind;
  path: string;
}
```

其中 `source.path` 是来源根目录，`manifestPath` 继续表示具体 manifest 文件路径。

示例：

```text
source.path = C:\Users\alice\AppData\Local\tooldeck\installed-plugins
manifestPath = C:\Users\alice\AppData\Local\tooldeck\installed-plugins\dev.example.my-plugin\manifest.json
```

## Duplicate 错误

重复 plugin id 或 command id 继续报错。1.3 不引入覆盖规则。

错误信息应包含：

- duplicate kind
- duplicate id
- existing plugin id
- incoming plugin id
- existing source kind
- incoming source kind
- existing manifest path
- incoming manifest path

安装流程依赖这些信息给出清晰错误。例如：

```text
Command id conflict: json.format
Existing source: builtin
Existing plugin: dev.tooldeck.json-tools
Incoming source: installed
Incoming plugin: dev.example.custom-json
```

## 启用/禁用语义

disabled 插件仍然被扫描，command 仍然可见，但运行时被阻止。

这样可以让 CLI/Desktop 展示：

- 插件存在。
- 插件来源。
- 插件贡献的 commands。
- 插件当前 disabled。

run command 时再检查 plugin state，并写入 error history。

## 非目标

scan source model 不做：

- 插件覆盖规则。
- external 热更新。
- installed update/replace。
- 多版本并存。
- marketplace source。
- remote registry source。

## 验收标准

- Scanner 支持 `builtin | installed | external`。
- 默认 CLI/Desktop scan source 包含 builtin 和 installed。
- `--plugin-dir` 增量加入 external。
- missing installed dir 不报错。
- missing external dir 报错。
- indexed plugin 和 command 包含 source metadata。
- duplicate plugin id 错误包含 source metadata。
- duplicate command id 错误包含 source metadata。
