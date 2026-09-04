<script setup lang="ts">
import { computed } from "vue";

import type { DesktopCommand } from "@/shared/api";

import { getInputFields, type CommandInputState, type CommandInputValue } from "../command-input";
import CommandField from "./CommandField.vue";

const props = defineProps<{
  command: DesktopCommand;
  draft?: CommandInputState;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [key: string, value: CommandInputValue] }>();
const fields = computed(() => getInputFields(props.command));
const { t } = useI18n();
</script>
<template>
  <div class="stack input-form" :class="{ 'input-empty': !fields.length }">
    <t-empty v-if="!fields.length" :title="t('command.form.noInputRequired')" description="" />
    <CommandField
      v-for="field in fields"
      :key="command.id + ':' + field.key"
      :field="field"
      :value="draft?.[field.key]"
      :disabled="disabled"
      @change="emit('change', field.key, $event)"
    />
  </div>
</template>

<style scoped>
.input-form {
  flex: 1;
}
.input-form.input-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
</style>
