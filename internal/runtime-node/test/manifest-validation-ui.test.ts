import type { JsonSchemaIssueCode } from "@tooldeck/json-schema";
import { describe, expect, it } from "vitest";

import { validatePluginManifest } from "@/index";

describe("manifest x-ui validation", () => {
  it("rejects input field order entries that do not reference input properties", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: {
              kind: "node",
              entry: "./dist/index.js",
            },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  inputSchema: {
                    type: "object",
                    "x-ui": {
                      fieldOrder: ["missing"],
                    },
                    properties: {
                      text: {
                        type: "string",
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.input-ui.field-order.unknown-property",
      "contributes.commands[0].inputSchema.x-ui.fieldOrder[0]",
    );
  });

  it("rejects unsupported input schema x-ui properties", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: {
              kind: "node",
              entry: "./dist/index.js",
            },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  inputSchema: {
                    type: "object",
                    "x-ui": {
                      layout: "vertical",
                    },
                    properties: {
                      text: {
                        type: "string",
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.input-ui.unsupported-property",
      "contributes.commands[0].inputSchema.x-ui.layout",
    );
  });

  it("rejects unsupported command-level x-ui layout values", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: {
              kind: "node",
              entry: "./dist/index.js",
            },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  "x-ui": {
                    layout: "grid",
                  },
                },
              ],
            },
          },
        }),
      "json-schema.enum",
      "contributes.commands[0].x-ui.layout",
    );
  });

  it("rejects x-ui on command output schemas", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: {
              kind: "node",
              entry: "./dist/index.js",
            },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  outputSchema: {
                    type: "object",
                    "x-ui": {
                      fieldOrder: ["blocks"],
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.output-ui.forbidden",
      "contributes.commands[0].outputSchema.x-ui",
    );
  });

  it("rejects x-ui nested below an input field", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: { kind: "node", entry: "./dist/index.js" },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  inputSchema: {
                    type: "object",
                    properties: {
                      options: {
                        type: "object",
                        properties: {
                          nested: {
                            type: "string",
                            "x-ui": { control: "text" },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.input-ui.invalid-location",
      "contributes.commands[0].inputSchema.properties.options.properties.nested.x-ui",
    );
  });

  it("rejects x-ui nested in command output schemas", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: { kind: "node", entry: "./dist/index.js" },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  outputSchema: {
                    type: "object",
                    properties: {
                      value: {
                        type: "string",
                        "x-ui": { control: "text" },
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.output-ui.forbidden",
      "contributes.commands[0].outputSchema.properties.value.x-ui",
    );
  });

  it("rejects field controls that are incompatible with the input schema", () => {
    expectManifestIssue(
      () =>
        validatePluginManifest({
          manifest: {
            schemaVersion: "1.0",
            id: "dev.tooldeck.bad",
            name: "Bad",
            version: "0.0.0",
            runtime: { kind: "node", entry: "./dist/index.js" },
            contributes: {
              commands: [
                {
                  id: "bad.run",
                  title: "Bad",
                  inputSchema: {
                    type: "object",
                    properties: {
                      count: {
                        type: "number",
                        "x-ui": { control: "checkbox" },
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      "tooldeck.input-ui.control.incompatible",
      "contributes.commands[0].inputSchema.properties.count.x-ui.control",
    );
  });
});

function expectManifestIssue(
  run: () => unknown,
  code: JsonSchemaIssueCode,
  propertyPath: string,
): void {
  let thrown: unknown;

  try {
    run();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toMatchObject({
    code: "ERR_INVALID_ARGUMENT",
    message: "Invalid plugin manifest",
    details: {
      schemaError: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code,
            propertyPath,
          }),
        ]),
      },
    },
  });
}
