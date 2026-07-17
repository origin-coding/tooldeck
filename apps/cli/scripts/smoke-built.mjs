import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const smokeDir = mkdtempSync(path.join(tmpdir(), "tooldeck-cli-smoke-"));
const sourceDist = path.resolve("dist");
const isolatedDist = path.join(smokeDir, "dist");
const storagePath = path.join(smokeDir, `tooldeck-${Date.now()}.sqlite`);
const builtCliEntry = path.join(isolatedDist, "index.js");
const args = [builtCliEntry, "run", "json.format", "--text", '{"a":1}', "--storage", storagePath];

if (!existsSync(path.join(sourceDist, "index.js"))) {
  throw new Error("Built CLI entry is missing. Run pnpm --filter @tooldeck/cli build first.");
}

console.log(`node dist/index.js run json.format --text '{"a":1}'`);

try {
  cpSync(sourceDist, isolatedDist, { recursive: true });

  const result = spawnSync(process.execPath, args, {
    cwd: smokeDir,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.status !== 0) {
    process.stdout.write(output);
    process.exitCode = result.status ?? 1;
  } else if (!output.includes('"a": 1')) {
    process.stdout.write(output);
    throw new Error("CLI smoke did not print formatted JSON output.");
  } else {
    process.stdout.write(result.stdout ?? "");
  }
} finally {
  rmSync(smokeDir, { recursive: true, force: true });
}
