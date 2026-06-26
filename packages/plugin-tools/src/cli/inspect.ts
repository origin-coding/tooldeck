import { defineCommand } from "citty";
import { consola } from "consola";

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

      consola.log(formatPluginInspection(result));

      if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        process.exitCode = 1;
      }
    },
  });
}
