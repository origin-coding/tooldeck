<script setup lang="ts">
import { computed } from "vue";

import { useDesktopBootstrap } from "@/renderer/app/bootstrap";
import { getTDesignConfig } from "@/renderer/i18n/tdesign";

const { locale } = useDesktopBootstrap();
const globalConfig = computed(() => getTDesignConfig(locale.value));
</script>

<template>
  <t-config-provider :global-config="globalConfig">
    <DesktopShell><NuxtPage /></DesktopShell>
  </t-config-provider>
</template>
