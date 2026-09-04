<script setup lang="ts">
import { computed } from "vue";

import HistoryWorkspace from "@/renderer/features/history/components/HistoryWorkspace.vue";

const route = useRoute();
const commandId = computed(() =>
  typeof route.query.command === "string" ? route.query.command : undefined,
);
</script>
<template><HistoryWorkspace :command-id="commandId" /></template>
