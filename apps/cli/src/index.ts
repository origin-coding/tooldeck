import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runMain } from "citty";
import { consola } from "consola";

import { createCliCommand } from "./cli";

const entryDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(entryDirectory, "../../..");
const bundledPluginsRoot = path.join(entryDirectory, "plugins");
const hasBundledPlugins = existsSync(bundledPluginsRoot);

const mainCommand = createCliCommand({
  appInstallDir: hasBundledPlugins ? entryDirectory : undefined,
  builtinPluginsDir: hasBundledPlugins ? bundledPluginsRoot : undefined,
  mode: hasBundledPlugins ? "production" : "development",
  workspaceRoot,
});

await runMain(mainCommand).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  consola.error(message);
  process.exitCode = 1;
});
