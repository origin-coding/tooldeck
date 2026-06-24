import { defineCommand } from "citty";

export function defineBuildCommand() {
  return defineCommand({
    meta: {
      name: "build",
      description: "Build a Tooldeck plugin project.",
    },
    run() {
      throw new Error(
        "tooldeck-plugin build is not implemented yet. Run tooldeck-plugin generate, your bundler, and tooldeck-plugin check --built.",
      );
    },
  });
}
