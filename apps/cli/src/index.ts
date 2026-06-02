import path from "node:path";
import { fileURLToPath } from "node:url";

import { runMain } from "citty";
import { consola } from "consola";
import { createCliCommand } from "./cli";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const mainCommand = createCliCommand({
  workspaceRoot,
});

await runMain(mainCommand).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  consola.error(message);
  process.exitCode = 1;
});
