import { defineCommand } from "citty";

import { formatPluginInspection, inspectPluginProject } from "../project";
import { createProjectInspectArgs, parseProjectInspectArgs } from "./args";

export function defineInspectCommand() {
  return defineCommand({
    meta: {
      name: "inspect",
      description: "Inspect a Tooldeck plugin project.",
    },
    args: createProjectInspectArgs(),
    async run({ rawArgs }) {
      const options = parseProjectInspectArgs(rawArgs, "tooldeck-plugin inspect");
      const result = await inspectPluginProject(options);

      console.log(formatPluginInspection(result));
    },
  });
}
