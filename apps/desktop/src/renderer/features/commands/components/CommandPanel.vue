<script setup lang="ts">
defineProps<{ title: string }>();
</script>
<template>
  <t-card :title="title" class="command-card">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <slot />
  </t-card>
</template>

<style scoped>
.command-card {
  display: flex;
  flex-direction: column;
  min-height: min(360px, calc(100dvh - 48px));
}
.command-card > :deep(.t-card__header) {
  flex-shrink: 0;
}
/* Card always wraps its body in Loading, even when loading is false. */
.command-card > :deep(.t-loading__parent),
.command-card > :deep(.t-loading__parent > .t-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
