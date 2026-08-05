# @tooldeck/cli

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
