# CLI Plugin Authoring Notes

This page is kept for older links. The current plugin authoring guide is
[Tooldeck Plugin Authoring](./README.md).

Current Tooldeck 1.3 authoring is no longer CLI-only. Desktop and CLI share the same
trusted local plugin model:

- Static `manifest.json` scanning.
- Lazy Node runtime activation.
- Commands-only plugin authoring for the first external project template.
- `@tooldeck/sdk-node`, `@tooldeck/plugin-tools`, and `@tooldeck/vite-plugin` as the
  public plugin authoring packages.
- `.tdplugin` packaging through `tooldeck-plugin pack` and `tooldeck-plugin dist`.
- Built-in, installed, and explicitly configured external plugin scan sources.
- Shared install, enable/disable, uninstall, and retained-data purge behavior.

Use the current guide for commands, package and installation examples, and 1.3 scope.
