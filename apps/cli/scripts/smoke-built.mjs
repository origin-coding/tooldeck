import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const smokeDir = path.resolve(".tmp", "smoke");
const storagePath = path.join(smokeDir, `tooldeck-${Date.now()}.sqlite`);
const builtCliEntry = path.resolve("dist", "index.js");
const args = [builtCliEntry, "run", "json.format", "--text", '{"a":1}', "--storage", storagePath];

mkdirSync(smokeDir, { recursive: true });

if (!existsSync(builtCliEntry)) {
  throw new Error("Built CLI entry is missing. Run pnpm --filter @tooldeck/cli build first.");
}

console.log(`node dist/index.js run json.format --text '{"a":1}'`);

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  encoding: "utf8",
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status !== 0) {
  process.stdout.write(output);
  process.exit(result.status ?? 1);
}

if (!output.includes('"a": 1')) {
  process.stdout.write(output);
  throw new Error("CLI smoke did not print formatted JSON output.");
}

process.stdout.write(result.stdout ?? "");
