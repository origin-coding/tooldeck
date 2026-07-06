import { defineCommand } from "citty";
import { consola } from "consola";

import {
  distPluginProject,
  formatPluginPackError,
  formatPluginPackResult,
  packPluginProject,
} from "../project";
import {
  createProjectDistArgs,
  createProjectPackArgs,
  parseProjectDistArgs,
  parseProjectPackArgs,
} from "./args";

export function definePackCommand() {
  return defineCommand({
    meta: {
      name: "pack",
      description: "Create a .tdplugin package from a built Tooldeck plugin project.",
    },
    args: createProjectPackArgs(),
    async run({ rawArgs }) {
      const options = parseProjectPackArgs(rawArgs, "tooldeck-plugin pack");

      try {
        const result = await packPluginProject(options);
        consola.success(formatPluginPackResult(result));
      } catch (error) {
        consola.error(formatPluginPackError(error));
        process.exitCode = 1;
      }
    },
  });
}

export function defineDistCommand() {
  return defineCommand({
    meta: {
      name: "dist",
      description: "Build a Tooldeck plugin project and create a .tdplugin package.",
    },
    args: createProjectDistArgs(),
    async run({ rawArgs }) {
      const options = parseProjectDistArgs(rawArgs, "tooldeck-plugin dist");

      try {
        const result = await distPluginProject(options);
        consola.success(formatPluginPackResult(result));
      } catch (error) {
        consola.error(formatPluginPackError(error));
        process.exitCode = 1;
      }
    },
  });
}
