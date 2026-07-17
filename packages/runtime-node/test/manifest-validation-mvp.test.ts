import { describe, expect, it } from "vitest";

import { validatePluginManifest } from "../src";

describe("manifest MVP boundaries", () => {
  it.each([
    ["activationEvents", { activationEvents: ["onCommand:hello.world"] }],
    [
      "permissions",
      {
        permissions: [
          {
            id: "storage:plugin",
            reason: "Store plugin data.",
          },
        ],
      },
    ],
    [
      "contributes.documents",
      {
        contributes: {
          commands: [],
          documents: [],
        },
      },
    ],
    [
      "contributes.tables",
      {
        contributes: {
          commands: [],
          tables: [],
        },
      },
    ],
    [
      "contributes.views",
      {
        contributes: {
          commands: [],
          views: [],
        },
      },
    ],
    [
      "contributes.settings",
      {
        contributes: {
          commands: [],
          settings: [],
        },
      },
    ],
    [
      "contributes.menus",
      {
        contributes: {
          commands: [],
          menus: [],
        },
      },
    ],
    [
      "contributes.fileHandlers",
      {
        contributes: {
          commands: [],
          fileHandlers: [],
        },
      },
    ],
  ])("rejects %s in the strict commands-only MVP manifest", (_name, override) => {
    expect(() =>
      validatePluginManifest({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.commands-only",
          name: "Commands Only",
          version: "0.0.0",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
          contributes: {
            commands: [
              {
                id: "hello.world",
                title: "Hello World",
              },
            ],
          },
          ...override,
        },
      }),
    ).toThrow("Invalid plugin manifest");
  });
});
