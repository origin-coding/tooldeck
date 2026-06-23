#!/usr/bin/env node

import { runMain } from "citty";

import { createPluginToolsCommand } from "./cli";

await runMain(createPluginToolsCommand()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
