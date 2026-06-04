#!/usr/bin/env node

import { runGenerateCommandTypesCli } from "./generate-command-types-runner";

await runGenerateCommandTypesCli(process.argv.slice(2));
