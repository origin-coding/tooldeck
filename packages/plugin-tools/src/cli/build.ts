import { defineCommand } from "citty";

import { buildPluginProject, formatPluginBuildError } from "../project";
import { createProjectBuildArgs, parseProjectBuildArgs } from "./args";

export function defineBuildCommand() {
  return defineCommand({
    meta: {
      name: "build",
      description: "Build a Tooldeck plugin project.",
    },
    args: createProjectBuildArgs(),
    async run({ rawArgs }) {
      const options = parseProjectBuildArgs(rawArgs, "tooldeck-plugin build");

      try {
        await buildPluginProject(options);
        console.log("Tooldeck plugin build passed.");
      } catch (error) {
        console.error(formatPluginBuildError(error));
        process.exitCode = 1;
      }
    },
  });
}
