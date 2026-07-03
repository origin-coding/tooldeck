# ADR 0001: .tdplugin ZIP Container

## Status

Accepted

## Date

2026-07-02

## Context

Tooldeck 1.3 引入本地插件打包和安装能力。插件作者应能将插件项目构建后打包为 `.tdplugin` 文件，再安装到 Tooldeck 管理的 installed plugin directory 中。

package container 是 Tooldeck 产品层格式，不属于核心 Toolbox Plugin Protocol。TPP 继续通过 `manifest.json` 描述插件能力；package container 描述 manifest、runtime output、locales 和相关文件如何作为本地安装包交付。

第一版实现有这些约束：

- 必须支持 ZIP 压缩和解压。
- 优先选择 TypeScript 实现和 TypeScript 使用体验较好的库。
- 避免 native modules，降低 Electron rebuild 风险。
- 最好支持便利的 package inspection，例如判断 entry 是否存在、读取 `manifest.json` 和 `tooldeck-package.json` 等单个 metadata 文件。
- 不需要支持非常大的插件包。对于 1.3 来说，几十 MB 已经属于很大的插件包。
- ZIP 库必须隔离在 adapter 后面，方便未来 side-loading 或大包需求变化时替换实现。

## Decision

`.tdplugin` 文件是 ZIP containers。

Tooldeck 1.3 P0 在 `@tooldeck/plugin-packages` 内部使用 `fflate` 作为 ZIP 实现。

`@tooldeck/plugin-packages` 必须通过内部 `ZipAdapter` 隐藏对 `fflate` 的直接使用。产品代码、CLI install 代码、Desktop install 代码和 package validation 代码应该依赖 Tooldeck package APIs，而不是依赖 `fflate` APIs。

1.3 P0 的 ZIP container 规则如下：

- package extension 是 `.tdplugin`。
- package 必须包含 root `manifest.json`。
- package 必须包含 root `tooldeck-package.json`。
- P0 不支持 ZIP64。
- P0 不支持 encrypted ZIP 和 password-protected ZIP。
- P0 不支持保留 file mode 和 executable bit。
- package validation 必须拒绝 absolute paths、path traversal、`node_modules` 和 symlink escape。
- package validation 必须统一限制 package size 和 file count。初始目标默认值是 50 MiB 和 1000 个 regular files，除非实现测试表明需要调整。

package digest 是生成后的 `.tdplugin` 文件字节 digest。同一个文件必须始终得到同一个 digest。1.3 P0 不要求 deterministic packaging，因此对同一个项目重新运行 `tooldeck-plugin pack` 可能产生不同的 package digest。

`@tooldeck/plugin-packages` 在 1.3 P0 中保持为 workspace-internal implementation package。在 package format、API shape、error model 和 compatibility expectations 稳定之前，不应作为 public npm package 对待。

## Consequences

使用 `fflate` 可以让实现保持 pure JavaScript/TypeScript，并避免 Electron native dependency rebuild 问题。

`fflate` 偏 memory-oriented 的 ZIP handling model 在 1.3 P0 中可以接受，因为 P0 会主动限制 package size 和 file count。如果未来插件包需要 streaming reads、真正的 random access、大型 archive 或 ZIP64 support，内部 `ZipAdapter` 会给 Tooldeck 留出可控的替换边界。

因为不要求 deterministic packaging，package creation 可以包含 `createdAt` 之类的正常生成 metadata。install records 仍然可以用 package digest 做诊断，并标识某一个具体 package file。

因为 encrypted ZIP、password ZIP、file mode preservation 和 executable bit preservation 都不在范围内，installer 可以为 trusted local-plugin MVP 保持更小的 validation surface。

## Alternatives Considered

### `adm-zip`

`adm-zip` 的 API 很方便，适合读取 entries、判断文件是否存在、读取文本和解压 archives。它是 pure JavaScript，不会引入 Electron native rebuild 风险。

没有选择它的原因是它不是 TypeScript-first 实现，TypeScript declarations 由 DefinitelyTyped 独立维护。Tooldeck 在这个 package boundary 更偏好 TypeScript implementation，以降低 implementation 和 types 之间漂移的风险。

### `JSZip`

`JSZip` 有友好的 high-level API，entry lookup 和 single-file reads 都比较直接。

它没有成为首选，是因为当前优先级更偏向 TypeScript implementation code 和小而清晰的 package-oriented adapter。如果 `fflate` 在实现中出现意外摩擦，`JSZip` 仍然是合理 fallback。

### `@zip.js/zip.js`

`@zip.js/zip.js` 是能力很完整的 ZIP library，feature coverage 更广。

1.3 P0 没有选择它，是因为 Tooldeck 还不需要更广的 ZIP feature surface。对于小型 trusted local plugin packages，额外的 API complexity 暂时不值得引入。

### `yauzl` + `yazl`

`yauzl` 和 `yazl` 是成熟的 Node ZIP libraries。如果 Tooldeck 未来需要 streaming-oriented reads、真正的 random access 或更强的大 archive 行为，它们会很有吸引力。

1.3 P0 没有选择它们，是因为它们不是 TypeScript-first，需要分别引入 read/write libraries，并且主要优化的是 Tooldeck 第一个本地插件打包里程碑明确不需要的约束。

## References

- [Tooldeck 1.3 Planning](../../planning/1.3.md)
- [Package Format](../../planning/1.3/package-format.md)
- [Plugin Packages](../../planning/1.3/plugin-packages.md)
- [`fflate`](https://github.com/101arrowz/fflate)
- [`adm-zip`](https://github.com/cthackers/adm-zip)
- [`JSZip`](https://github.com/Stuk/jszip)
- [`@zip.js/zip.js`](https://github.com/gildas-lormeau/zip.js)
- [`yauzl`](https://github.com/thejoshwolfe/yauzl)
- [`yazl`](https://github.com/thejoshwolfe/yazl)
