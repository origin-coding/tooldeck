# CLI Plugin Authoring Notes

This page is kept for older links. The current plugin authoring guide is
[Tooldeck Plugin Authoring](./README.md).

Current V1/V1.2 authoring is no longer CLI-only. Desktop and CLI share the same trusted
local plugin model:

- Static `manifest.json` scanning.
- Lazy Node runtime activation.
- Commands-only plugin authoring for the first external project template.
- `@tooldeck/sdk-node`, `@tooldeck/plugin-tools`, and `@tooldeck/vite-plugin` as the
  public plugin authoring packages.

Use the current guide for commands, examples, and V1.2 non-goals.
