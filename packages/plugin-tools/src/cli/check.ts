import { defineCommand } from "citty";

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

      console.log(formatPluginCheckResult(result));

      if (!result.ok) {
        process.exitCode = 1;
      }
    },
  });
}
