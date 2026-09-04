import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";

// Bundle both locales; packaged Desktop cannot fetch messages from an HTTP API.
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: "en-US",
  messages: { "en-US": enUS, "zh-CN": zhCN },
}));
