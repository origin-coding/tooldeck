<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ status: string }>();
const { t, te } = useI18n();
const theme = computed(() =>
  ["success", "active"].includes(props.status)
    ? "success"
    : ["error", "failed"].includes(props.status)
      ? "danger"
      : ["activating", "deactivating"].includes(props.status)
        ? "warning"
        : "default",
);
</script>
<template>
  <t-tag :theme="theme" variant="light">{{
    te(`status.${status}`) ? t(`status.${status}`) : status
  }}</t-tag>
</template>
