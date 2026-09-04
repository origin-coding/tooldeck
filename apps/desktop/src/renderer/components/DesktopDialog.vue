<script setup lang="ts">
defineOptions({ inheritAttrs: false });
defineProps<{ dialogClassName?: string }>();
</script>
<template>
  <t-dialog
    v-bind="$attrs"
    :dialog-class-name="['desktop-dialog', dialogClassName].filter(Boolean).join(' ')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps"
      ><slot :name="name" v-bind="slotProps ?? {}"
    /></template>
  </t-dialog>
</template>

<style>
/* Constrain the entire dialog; only its content may scroll. */
.t-dialog.desktop-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
}
.desktop-dialog > .t-dialog__header {
  flex-shrink: 0;
}
.desktop-dialog > .t-dialog__body {
  min-height: 0;
}
</style>
