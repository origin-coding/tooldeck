import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parsePluginDirArgs,
  parsePluginDirsEnv,
  resolveDesktopPluginDirs,
} from "@/main/plugin-dirs";

describe("desktop plugin dir resolution", () => {
  it("parses repeated --plugin-dir arguments", () => {
    expect(
      parsePluginDirArgs([
        "electron",
        ".",
        "--plugin-dir",
        "../external-a",
        "--plugin-dir=../external-b",
      ]),
    ).toEqual(["../external-a", "../external-b"]);
  });

  it("parses TOOLDECK_PLUGIN_DIRS with the platform delimiter", () => {
    expect(parsePluginDirsEnv(["../external-a", "../external-b"].join(path.delimiter))).toEqual([
      "../external-a",
      "../external-b",
    ]);
  });

  it("resolves argv and env plugin dirs against the launch base dir", () => {
    const baseDir = path.resolve("workspace");

    expect(
      resolveDesktopPluginDirs({
        argv: ["electron", ".", "--plugin-dir", "../external-a"],
        baseDir,
        env: {
          TOOLDECK_PLUGIN_DIRS: "../external-b",
        },
      }),
    ).toEqual([path.resolve(baseDir, "../external-a"), path.resolve(baseDir, "../external-b")]);
  });

  it("throws a clear error when --plugin-dir has no value", () => {
    expect(() => parsePluginDirArgs(["electron", ".", "--plugin-dir"])).toThrow(
      "Missing value for --plugin-dir.",
    );
  });
});
