import { builtinModules } from "node:module";

import type { UserConfig } from "vite";

export const mainProcessExternal = [
  "electron",
  "electron-updater",
  ...builtinModules,
  /^node:/,
  // "@tooldeck/runtime-node",
  // "@tooldeck/host-node",
  // "@tooldeck/protocol",
  // "@tooldeck/shared",
  // "@tooldeck/storage",
];

export const nodeTarget = "node22";

export const sourcemapBuild: UserConfig["build"] = {
  sourcemap: true,
  minify: false,
};
