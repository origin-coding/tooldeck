import { ConfigProvider } from "antd";
import type { Locale } from "antd/es/locale";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import type { TooldeckAppLocale } from "@/renderer/i18n";

import "./i18n";

import "antd/dist/reset.css";
import "./global.css";

import { App } from "./App";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

createRoot(root).render(
  <StrictMode>
    <DesktopConfigProvider />
  </StrictMode>,
);

const antdLocales = {
  "en-US": enUS,
  "zh-CN": zhCN,
} satisfies Record<TooldeckAppLocale, Locale>;

function mapAntdLocale(locale: string | undefined): Locale {
  return isTooldeckAppLocale(locale) ? antdLocales[locale] : antdLocales["en-US"];
}

function isTooldeckAppLocale(locale: string | undefined): locale is TooldeckAppLocale {
  return locale === "en-US" || locale === "zh-CN";
}

function DesktopConfigProvider() {
  const { i18n } = useTranslation();

  return (
    <ConfigProvider locale={mapAntdLocale(i18n.resolvedLanguage ?? i18n.language)}>
      <App />
    </ConfigProvider>
  );
}
