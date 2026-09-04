# @tooldeck/vite-plugin

## 1.4.0

### Minor Changes

- Release the Tooldeck 1.4 plugin authoring and application stack.
  - Publish shared, Effect-neutral Draft-07 execution in `@tooldeck/json-schema`, with scoped engines, opaque validators, JSON-safe input copying, and neutral diagnostics.
  - Align manifest and command input/output validation across runtime, package handling, and author tools with the supported TPP v1 profiles.
  - Keep protocol data separate from SDK validation helpers and private Node implementation; retain the commands-only trusted local plugin lifecycle.
  - Update generated plugin projects and the Vite 8 authoring toolchain together with the 1.4 package versions.
  - Run the CLI through the shared Node application service and package validated built-in plugins for distribution.

## 1.3.0

### Minor Changes

- b80d3c2: Align the generated plugin project and Vite integration with the Tooldeck 1.3 authoring and packaging workflow.

## 1.2.0

### Minor Changes

- Prepare 1.2.0 release for npm-trusted packages.
