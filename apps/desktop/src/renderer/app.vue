<script setup lang="ts">
import enUS from "tdesign-vue-next/es/locale/en_US";
import zhCN from "tdesign-vue-next/es/locale/zh_CN";
import { computed, onMounted, watch } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { writeDesktopSession } from "@/renderer/utils/session";

const workspace = useWorkspaceStore();
const route = useRoute();
const { locale, setLocale } = useI18n();
const globalConfig = computed(() => {
  const messages = locale.value === "zh-CN" ? zhCN : enUS;
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
});
useHead(() => ({ htmlAttrs: { lang: locale.value } }));
watch(
  () => workspace.locale,
  (value) => void setLocale(value),
  { immediate: true },
);
watch(
  () => route.fullPath,
  (path) => {
    if (path !== "/" && workspace.initialized) writeDesktopSession({ path });
  },
);
onMounted(() => void workspace.initialize());
</script>

<template>
  <t-config-provider :global-config="globalConfig">
    <DesktopShell><NuxtPage /></DesktopShell>
  </t-config-provider>
</template>
