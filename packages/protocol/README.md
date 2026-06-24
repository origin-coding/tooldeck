# @tooldeck/protocol

Toolbox Plugin Protocol types and JSON Schema for Tooldeck.

This package defines the protocol-facing TypeScript types shared by Tooldeck apps,
runtime packages, SDKs, and plugin authoring tools.

## Install

```bash
pnpm add @tooldeck/protocol
```

Most plugin authors do not need to import this package directly. Use
`@tooldeck/sdk-node` for runtime code and `@tooldeck/plugin-tools` for manifest-driven
type generation.

## Exports

```ts
import type { CommandResult, ContentBlock, TooldeckPluginManifest } from "@tooldeck/protocol";
```

The manifest JSON Schema is also exported:

```text
@tooldeck/protocol/schema/manifest-v1.schema.json
```

Plugin projects can reference it from `manifest.json`:

```json
{
  "$schema": "./node_modules/@tooldeck/protocol/schema/manifest-v1.schema.json"
}
```

## Protocol Boundaries

`@tooldeck/protocol` contains protocol types and schema definitions only. It does not
depend on Electron, React, SQLite, Node plugin hosting, or UI code.

Manifest data is a static declaration. Scanning a manifest must not import or execute
plugin runtime code.

## References

- [TPP v1 design](../../docs/architecture/tpp-v1.md)
- [V1 scope](../../docs/architecture/v1-scope.md)
