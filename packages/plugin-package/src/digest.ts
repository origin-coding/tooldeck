import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function computePackageDigest(packagePath: string): Promise<string> {
  const data = await readFile(packagePath);

  return createHash("sha256").update(data).digest("hex");
}
