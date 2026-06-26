import type { LocalizedString } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import {
  createLocaleFallbacks,
  flattenLocaleResource,
  resolveJsonSchemaI18n,
  resolveLocalizedString,
} from "../src";

describe("locale resolution", () => {
  it("returns plain strings unchanged", () => {
    expect(
      resolveLocalizedString({
        value: "JSON Tools",
        locale: "zh-CN",
      }),
    ).toBe("JSON Tools");
  });

  it("resolves localized strings with locale and language fallbacks", () => {
    const value: LocalizedString = {
      key: "plugin.name",
      default: "JSON Tools",
    };

    expect(
      resolveLocalizedString({
        value,
        locale: "zh-CN",
        defaultLocale: "en",
        resources: {
          "zh-CN": {
            "plugin.name": "JSON 工具",
          },
          en: {
            "plugin.name": "JSON Tools",
          },
        },
      }),
    ).toBe("JSON 工具");

    expect(
      resolveLocalizedString({
        value,
        locale: "en-US",
        defaultLocale: "zh-CN",
        resources: {
          en: {
            "plugin.name": "JSON Tools from language fallback",
          },
          "zh-CN": {
            "plugin.name": "JSON 工具",
          },
        },
      }),
    ).toBe("JSON Tools from language fallback");
  });

  it("falls back to the manifest default locale before the LocalizedString default", () => {
    expect(
      resolveLocalizedString({
        value: {
          key: "commands.format.title",
          default: "Format JSON",
        },
        locale: "fr-FR",
        defaultLocale: "zh-CN",
        resources: {
          "zh-CN": {
            "commands.format.title": "格式化 JSON",
          },
        },
      }),
    ).toBe("格式化 JSON");
  });

  it("returns the LocalizedString default when no translation is available", () => {
    expect(
      resolveLocalizedString({
        value: {
          key: "missing",
          default: "Fallback",
        },
        locale: "zh-CN",
        defaultLocale: "en",
        resources: {
          en: {},
          "zh-CN": {},
        },
      }),
    ).toBe("Fallback");
  });

  it("creates unique locale fallback chains", () => {
    expect(createLocaleFallbacks("en-US", "en")).toEqual(["en-US", "en"]);
    expect(createLocaleFallbacks("zh-CN", "en-US")).toEqual(["zh-CN", "zh", "en-US", "en"]);
  });

  it("flattens nested locale resources", () => {
    expect(
      flattenLocaleResource({
        plugin: {
          name: "JSON 工具",
          description: "用于格式化 JSON 的工具。",
        },
        "commands.format.title": "格式化 JSON",
      }),
    ).toEqual({
      "plugin.name": "JSON 工具",
      "plugin.description": "用于格式化 JSON 的工具。",
      "commands.format.title": "格式化 JSON",
    });
  });

  it("resolves JSON Schema x-i18n display fields", () => {
    expect(
      resolveJsonSchemaI18n({
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "JSON Text",
              description: "Input JSON text.",
              "x-i18n": {
                title: "schema.format.text.title",
                description: "schema.format.text.description",
              },
            },
          },
        },
        locale: "zh-CN",
        defaultLocale: "en",
        resources: {
          "zh-CN": {
            "schema.format.text.title": "JSON 文本",
            "schema.format.text.description": "输入 JSON 文本。",
          },
        },
      }),
    ).toMatchObject({
      properties: {
        text: {
          title: "JSON 文本",
          description: "输入 JSON 文本。",
        },
      },
    });
  });

  it("resolves JSON Schema x-i18n enum labels", () => {
    expect(
      resolveJsonSchemaI18n({
        schema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["first", "all"],
              "x-i18n": {
                title: "schema.scope.title",
                enumLabels: {
                  first: "schema.scope.options.first",
                  all: "schema.scope.options.all",
                },
              },
            },
          },
        },
        locale: "zh-CN",
        defaultLocale: "en",
        resources: {
          "zh-CN": {
            "schema.scope.title": "替换范围",
            "schema.scope.options.first": "首次",
            "schema.scope.options.all": "全部",
          },
        },
      }),
    ).toMatchObject({
      properties: {
        scope: {
          title: "替换范围",
          "x-enumLabels": {
            first: "首次",
            all: "全部",
          },
        },
      },
    });
  });
});
