#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../dist/tooldeck-plugin.js");

if (!existsSync(entry)) {
  console.error(
    "tooldeck-plugin has not been built yet. Run `pnpm --filter @tooldeck/plugin-tools build` first.",
  );
  process.exit(1);
}

await import(pathToFileURL(entry).href);
