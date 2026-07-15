import { describe, expect, it } from "vitest";

import { validatePluginPackageDrop } from "./plugin-package-drop";

describe("validatePluginPackageDrop", () => {
  it("accepts exactly one .tdplugin package", () => {
    const file = createFile("dev.example.tools-1.0.0.tdplugin");

    expect(validatePluginPackageDrop([file])).toEqual({ valid: true, file });
  });

  it("rejects an empty drop", () => {
    expect(validatePluginPackageDrop([])).toEqual({ valid: false, reason: "empty" });
  });

  it("rejects multiple files", () => {
    expect(
      validatePluginPackageDrop([createFile("one.tdplugin"), createFile("two.tdplugin")]),
    ).toEqual({ valid: false, reason: "multiple" });
  });

  it("rejects other and differently-cased extensions", () => {
    expect(validatePluginPackageDrop([createFile("plugin.zip")])).toEqual({
      valid: false,
      reason: "invalid-extension",
    });
    expect(validatePluginPackageDrop([createFile("plugin.TDPLUGIN")])).toEqual({
      valid: false,
      reason: "invalid-extension",
    });
  });
});

function createFile(name: string): File {
  return { name } as File;
}
