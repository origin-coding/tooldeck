import type { ConfigProviderProps } from "tdesign-vue-next";
import enUS from "tdesign-vue-next/es/locale/en_US";
import zhCN from "tdesign-vue-next/es/locale/zh_CN";

export function getTDesignConfig(locale: string): NonNullable<ConfigProviderProps["globalConfig"]> {
  const messages = locale === "zh-CN" ? zhCN : enUS;
  // TDesign's locale exports use readonly tuples, while ConfigProvider expects
  // mutable arrays. Copy those arrays without changing the shared locale pack.
  return {
    ...messages,
    datePicker: {
      ...messages.datePicker,
      weekdays: [...messages.datePicker.weekdays],
      months: [...messages.datePicker.months],
      quarters: [...messages.datePicker.quarters],
    },
    rate: { ...messages.rate, rateText: [...messages.rate.rateText] },
  };
}
