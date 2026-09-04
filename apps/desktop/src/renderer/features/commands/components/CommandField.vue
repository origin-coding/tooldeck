<script setup lang="ts">
import { computed } from "vue";

import type { CommandInputValue, InputField } from "@/renderer/features/commands/command-input";

const props = defineProps<{ field: InputField; value?: CommandInputValue; disabled?: boolean }>();
const emit = defineEmits<{ change: [value: CommandInputValue] }>();
const { t } = useI18n();
const id = computed(() => `command-input-${props.field.key}`);
const options = computed(() =>
  "options" in props.field
    ? props.field.options.map((option) => ({
        label: option.label,
        value: JSON.stringify(option.value),
      }))
    : [],
);
const choice = computed(() =>
  props.value === undefined ? undefined : JSON.stringify(props.value),
);
const choices = computed(() =>
  Array.isArray(props.value) ? props.value.map((value) => JSON.stringify(value)) : [],
);
function select(value: unknown) {
  const option =
    "options" in props.field
      ? props.field.options.find((item) => JSON.stringify(item.value) === value)
      : undefined;
  emit("change", option?.value ?? (option ? null : ""));
}
function selectMany(value: unknown) {
  if (!Array.isArray(value) || !("options" in props.field)) return;
  emit(
    "change",
    props.field.options
      .filter((item) => value.includes(JSON.stringify(item.value)))
      .map((item) => item.value),
  );
}
function number(value: unknown) {
  emit("change", typeof value === "number" || typeof value === "string" ? value : "");
}
</script>

<template>
  <div class="form-field">
    <label :id="`${id}-label`" :for="id"
      >{{ field.title }}
      <t-tag v-if="field.required" size="small" variant="light">{{
        t("command.form.required")
      }}</t-tag></label
    >
    <t-textarea
      v-if="field.kind === 'textarea'"
      :id="id"
      :value="String(value ?? '')"
      :disabled="disabled"
      :placeholder="field.placeholder"
      :autosize="{ minRows: field.rows ?? 8, maxRows: 24 }"
      @change="emit('change', $event)"
    />
    <t-input-number
      v-else-if="field.kind === 'number'"
      :id="id"
      :value="typeof value === 'number' || typeof value === 'string' ? value : ''"
      :disabled="disabled"
      :min="field.minimum"
      :max="field.maximum"
      :placeholder="field.placeholder"
      :step="1"
      @change="number"
    />
    <t-switch
      v-else-if="field.kind === 'checkbox'"
      :id="id"
      :value="value === true"
      :disabled="disabled"
      :aria-labelledby="`${id}-label`"
      @change="emit('change', $event === true)"
    />
    <t-radio-group
      v-else-if="field.kind === 'radio'"
      :value="choice"
      :options="options"
      :disabled="disabled"
      :aria-labelledby="`${id}-label`"
      @change="select"
    />
    <t-select
      v-else-if="field.kind === 'select'"
      :id="id"
      :value="choice"
      :options="options"
      :disabled="disabled"
      :placeholder="field.placeholder"
      :aria-labelledby="`${id}-label`"
      @change="select"
    />
    <t-checkbox-group
      v-else-if="field.kind === 'checkboxGroup'"
      :value="choices"
      :options="options"
      :disabled="disabled"
      :aria-labelledby="`${id}-label`"
      @change="selectMany"
    />
    <t-select
      v-else-if="field.kind === 'multiSelect'"
      :id="id"
      multiple
      :value="choices"
      :options="options"
      :disabled="disabled"
      :placeholder="field.placeholder"
      :aria-labelledby="`${id}-label`"
      @change="selectMany"
    />
    <t-input
      v-else
      :id="id"
      :value="String(value ?? '')"
      :disabled="disabled"
      :placeholder="field.placeholder"
      @change="emit('change', $event)"
    />
    <small v-if="field.description" class="muted">{{ field.description }}</small>
  </div>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 8px;
}
.form-field label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.form-field :deep(.t-input-number) {
  width: 100%;
}
</style>
