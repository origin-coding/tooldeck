import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";

export type TooldeckAppLocale = "en-US" | "zh-CN";
export type TooldeckLocalePreference = "system" | TooldeckAppLocale;

const resources = {
  "en-US": {
    translation: enUS,
  },
  "zh-CN": {
    translation: zhCN,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveAppLocale("system"),
  fallbackLng: "en-US",
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export async function applyLocalePreference(value: unknown): Promise<TooldeckAppLocale> {
  const locale = resolveAppLocale(value);

  await i18n.changeLanguage(locale);

  return locale;
}

export function getCurrentAppLocale(): TooldeckAppLocale {
  return resolveAppLocale(i18n.resolvedLanguage ?? i18n.language);
}

export function isTooldeckLocalePreference(value: unknown): value is TooldeckLocalePreference {
  return value === "system" || value === "en-US" || value === "zh-CN";
}

export function resolveAppLocale(value: unknown): TooldeckAppLocale {
  if (value === "en-US" || value === "zh-CN") {
    return value;
  }

  const systemLanguage = globalThis.navigator?.language ?? "en-US";

  if (systemLanguage === "zh-CN" || systemLanguage.startsWith("zh")) {
    return "zh-CN";
  }

  return "en-US";
}

export { i18n };
