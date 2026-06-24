import { defineCommand } from "citty";
import { consola } from "consola";

import { checkPluginProject, formatPluginCheckResult } from "../project";
import { createProjectCheckArgs, parseProjectCheckArgs } from "./args";

export function defineCheckCommand() {
  return defineCommand({
    meta: {
      name: "check",
      description: "Check a Tooldeck plugin project.",
    },
    args: createProjectCheckArgs(),
    async run({ rawArgs }) {
      const options = parseProjectCheckArgs(rawArgs, "tooldeck-plugin check");
      const result = await checkPluginProject(options);

      if (!result.ok) {
        consola.error(formatPluginCheckResult(result));
        process.exitCode = 1;
      } else {
        consola.success("Plugin project check passed.");
      }
    },
  });
}
