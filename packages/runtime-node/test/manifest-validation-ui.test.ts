import { describe, expect, it } from "vitest";

import { validatePluginManifest } from "../src";

describe("manifest x-ui validation", () => {
  it("rejects input field order entries that do not reference input properties", () => {
    expect(() =>
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
    ).toThrow("references unknown input field 'missing'");
  });

  it("rejects unsupported input schema x-ui properties", () => {
    expect(() =>
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
    ).toThrow("is not a supported input schema x-ui property");
  });

  it("rejects unsupported command-level x-ui layout values", () => {
    expect(() =>
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
    ).toThrow("Invalid plugin manifest");
  });

  it("rejects x-ui on command output schemas", () => {
    expect(() =>
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
    ).toThrow("is not supported on command output schemas");
  });

  it("rejects x-ui nested below an input field", () => {
    expect(() =>
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
    ).toThrow("is only supported at the input schema root or on its direct properties");
  });

  it("rejects x-ui nested in command output schemas", () => {
    expect(() =>
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
    ).toThrow("is not supported on command output schemas");
  });

  it("rejects field controls that are incompatible with the input schema", () => {
    expect(() =>
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
    ).toThrow("is incompatible with the field schema");
  });
});
