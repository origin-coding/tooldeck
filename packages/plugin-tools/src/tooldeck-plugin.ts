#!/usr/bin/env node

import { runMain } from "citty";
import { consola } from "consola";

import { createPluginToolsCommand } from "./cli";

await runMain(createPluginToolsCommand()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  consola.error(message);
  process.exitCode = 1;
});
