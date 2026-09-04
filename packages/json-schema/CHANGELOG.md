# @tooldeck/json-schema

## 0.1.0

### Minor Changes

- Release the Tooldeck 1.4 plugin authoring and application stack.
  - Publish shared, Effect-neutral Draft-07 execution in `@tooldeck/json-schema`, with scoped engines, opaque validators, JSON-safe input copying, and neutral diagnostics.
  - Align manifest and command input/output validation across runtime, package handling, and author tools with the supported TPP v1 profiles.
  - Keep protocol data separate from SDK validation helpers and private Node implementation; retain the commands-only trusted local plugin lifecycle.
  - Update generated plugin projects and the Vite 8 authoring toolchain together with the 1.4 package versions.
  - Run the CLI through the shared Node application service and package validated built-in plugins for distribution.

### Patch Changes

- Updated dependencies
  - @tooldeck/protocol@1.4.0
