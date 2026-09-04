# @tooldeck/cli

## 1.4.0

### Minor Changes

- Release the Tooldeck 1.4 plugin authoring and application stack.
  - Publish shared, Effect-neutral Draft-07 execution in `@tooldeck/json-schema`, with scoped engines, opaque validators, JSON-safe input copying, and neutral diagnostics.
  - Align manifest and command input/output validation across runtime, package handling, and author tools with the supported TPP v1 profiles.
  - Keep protocol data separate from SDK validation helpers and private Node implementation; retain the commands-only trusted local plugin lifecycle.
  - Update generated plugin projects and the Vite 8 authoring toolchain together with the 1.4 package versions.
  - Run the CLI through the shared Node application service and package validated built-in plugins for distribution.

## 1.4.0 (Unreleased)

### Changed

- Normalize Runtime and Application cleanup, rollback, and retained-cleanup diagnostics to the
  canonical `cleanupFailures` array. JSON output no longer emits `cleanupError`, singular
  `cleanupFailure`, `rollbackErrors`, or generic cleanup `errors` fields.
- Keep logically committed uninstall operations successful when quarantine removal is retained;
  text output reports a warning and JSON output includes `cleanupPending` plus structured
  diagnostics.

## 1.3.0

### Minor Changes

- 7be7406: Add the local `.tdplugin` install and uninstall workflow, plugin enable, disable, and
  retained-data purge commands, source-aware plugin output, installed command execution, and
  non-zero exits for error command results.

## 1.2.0

### Minor Changes

- Prepare 1.2.0 release for npm-trusted packages.
