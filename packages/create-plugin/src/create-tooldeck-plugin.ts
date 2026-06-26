#!/usr/bin/env node

import { runMain } from "citty";
import { consola } from "consola";

import { createCreatePluginCommand } from "./cli";

await runMain(createCreatePluginCommand()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  consola.error(message);
  process.exitCode = 1;
});
