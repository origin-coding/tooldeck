import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { computePackageDigest, readTooldeckPackage, unpackTooldeckPackage } from "../src";
import { createReadablePackage } from "./package-test-fixtures";

describe("Tooldeck plugin package extraction", () => {
  it("computes a stable digest for the same package bytes", async () => {
    const packagePath = await createReadablePackage();

    await expect(computePackageDigest(packagePath)).resolves.toBe(
      await computePackageDigest(packagePath),
    );
    await expect(readTooldeckPackage({ packagePath })).resolves.toMatchObject({
      packageDigest: await computePackageDigest(packagePath),
    });
  });

  it("unpacks packages inside the destination directory", async () => {
    const packagePath = await createReadablePackage();
    const destinationDir = path.join(path.dirname(packagePath), "installed");

    await unpackTooldeckPackage({
      packagePath,
      destinationDir,
    });

    await expect(readFile(path.join(destinationDir, "dist", "index.js"), "utf8")).resolves.toBe(
      "export default { activate() {} };\n",
    );
  });
});
