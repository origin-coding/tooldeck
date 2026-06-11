import { describe, expect, it } from "vitest";

import type { DesktopCommand } from "@/shared/desktop-api";

import { buildCommandInput, createInputState, getInputFields } from "./command-input";

describe("command input fields", () => {
  it("orders fields with inputSchema x-ui.fieldOrder and appends unspecified fields", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          "x-ui": {
            fieldOrder: ["second", "first"],
          },
          properties: {
            first: {
              type: "string",
            },
            second: {
              type: "string",
            },
            third: {
              type: "integer",
            },
          },
        },
      }).map((field) => field.key),
    ).toEqual(["second", "first", "third"]);
  });

  it("reads field-level inputSchema x-ui controls", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              "x-ui": {
                control: "text",
                placeholder: {
                  key: "schema.query.placeholder",
                  default: "Search text",
                },
              },
            },
            body: {
              type: "string",
              "x-ui": {
                control: "textarea",
                rows: 6,
                placeholder: "Paste JSON",
              },
            },
            count: {
              type: "integer",
              "x-ui": {
                control: "number",
              },
            },
          },
        },
      }),
    ).toMatchObject([
      {
        key: "query",
        kind: "text",
        placeholder: "Search text",
      },
      {
        key: "body",
        kind: "textarea",
        placeholder: "Paste JSON",
        rows: 6,
      },
      {
        key: "count",
        kind: "number",
      },
    ]);
  });

  it("infers default controls from JSON Schema shapes", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
            },
            mode: {
              type: "string",
              enum: ["fast", "safe", "full"],
            },
            country: {
              type: "string",
              enum: ["AU", "BR", "CA", "DE", "FR"],
            },
            flags: {
              type: "array",
              items: {
                type: "string",
                enum: ["pretty", "strict"],
              },
            },
            tags: {
              type: "array",
              items: {
                type: "string",
                enum: ["a", "b", "c", "d", "e", "f", "g"],
              },
            },
          },
        },
      }).map((field) => ({
        key: field.key,
        kind: field.kind,
        options: "options" in field ? field.options.map((option) => option.value) : undefined,
      })),
    ).toEqual([
      {
        key: "enabled",
        kind: "checkbox",
        options: undefined,
      },
      {
        key: "mode",
        kind: "radio",
        options: ["fast", "safe", "full"],
      },
      {
        key: "country",
        kind: "select",
        options: ["AU", "BR", "CA", "DE", "FR"],
      },
      {
        key: "flags",
        kind: "checkboxGroup",
        options: ["pretty", "strict"],
      },
      {
        key: "tags",
        kind: "multiSelect",
        options: ["a", "b", "c", "d", "e", "f", "g"],
      },
    ]);
  });

  it("uses compatible explicit controls and falls back for incompatible hints", () => {
    expect(
      getInputFields({
        id: "example.run",
        pluginId: "dev.tooldeck.example",
        pluginEnabled: true,
        pluginRuntimeState: "inactive",
        title: "Example",
        searchText: [],
        inputSchema: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              enum: ["fast", "safe", "full", "debug", "trace"],
              "x-ui": {
                control: "radio",
              },
            },
            flags: {
              type: "array",
              items: {
                type: "string",
                enum: ["pretty", "strict"],
              },
              "x-ui": {
                control: "multiSelect",
              },
            },
            enabled: {
              type: "boolean",
              "x-ui": {
                control: "select",
              },
            },
          },
        },
      }).map((field) => ({
        key: field.key,
        kind: field.kind,
      })),
    ).toEqual([
      {
        key: "mode",
        kind: "radio",
      },
      {
        key: "flags",
        kind: "multiSelect",
      },
      {
        key: "enabled",
        kind: "checkbox",
      },
    ]);
  });

  it("creates typed defaults and builds typed command input values", () => {
    const command: DesktopCommand = {
      id: "example.run",
      pluginId: "dev.tooldeck.example",
      pluginEnabled: true,
      pluginRuntimeState: "inactive",
      title: "Example",
      searchText: [],
      inputSchema: {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            default: true,
          },
          count: {
            type: "integer",
            default: 2,
          },
          mode: {
            type: "string",
            enum: ["fast", "safe"],
            default: "safe",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
              enum: ["a", "b"],
            },
            default: ["a"],
          },
        },
      },
    };

    const inputState = createInputState(command, {});

    expect(inputState).toEqual({
      enabled: true,
      count: 2,
      mode: "safe",
      tags: ["a"],
    });
    expect(
      buildCommandInput(command, {
        ...inputState,
        enabled: false,
        count: 4,
        tags: ["a", "b"],
      }),
    ).toEqual({
      enabled: false,
      count: 4,
      mode: "safe",
      tags: ["a", "b"],
    });
  });
});
