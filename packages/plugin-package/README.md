# @tooldeck/plugin-package

Public utilities for the Tooldeck `.tdplugin` local package format.

Most plugin authors should use `tooldeck-plugin pack` or `tooldeck-plugin dist` from
`@tooldeck/plugin-tools`. Use this package directly when implementing package inspection,
validation, or another Tooldeck-compatible local packaging workflow.

## Install

```bash
pnpm add @tooldeck/plugin-package
```

## Main APIs

```ts
import {
  packTooldeckPlugin,
  readTooldeckPackage,
  unpackTooldeckPackage,
  validateTooldeckPackage,
} from "@tooldeck/plugin-package";
```

- `packTooldeckPlugin` creates and validates a `.tdplugin` archive from a plugin project.
- `readTooldeckPackage` reads and validates package metadata without unpacking it.
- `validateTooldeckPackage` validates a package and returns its summary.
- `unpackTooldeckPackage` validates and safely extracts a package to a caller-owned
  destination directory.

The caller owns the unpack destination and must remove it when inspection or installation
finishes, including after failures.

The package also exports format constants, default size and file-count limits, package
path helpers, digest calculation, manifest validation, result types, and the ZIP adapter
contract.

## Format and Safety

A `.tdplugin` is a ZIP container with root `manifest.json` and
`tooldeck-package.json`. Validation rejects unsafe or inconsistent paths, undeclared or
missing files, `node_modules`, unsupported archive features, excessive size or file
counts, and missing runtime or locale files.

This package owns the container format. It does not install plugins, persist Tooldeck
state, scan plugin sources, activate runtime code, or provide UI. Those responsibilities
belong to Tooldeck product services and runtime packages.

Tooldeck 1.3 supports trusted local plugins only. Package validation is not an untrusted
plugin sandbox or code-signing system.
