<script setup lang="ts">
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";

defineProps<{ result?: CommandResult; error?: string; running?: boolean }>();
const { t } = useI18n();
function label(value: LocalizedString) {
  return typeof value === "string" ? value : value.default;
}
</script>

<template>
  <div
    class="command-output"
    :class="{
      'output-centered':
        running ||
        (!result && !error) ||
        (result?.status === 'success' && !result.blocks.length && !error),
    }"
    :aria-busy="running"
  >
    <t-loading v-if="running" :text="t('command.outputState.running')" />
    <template v-else>
      <t-alert v-if="error" theme="error" :title="t('command.runFailed')" :message="error" />
      <t-alert
        v-else-if="result?.status === 'error'"
        theme="error"
        :title="t('command.outputState.commandFailed')"
        :message="result.error?.message ?? t('command.outputState.errorResult')"
      />
      <t-empty
        v-if="!result && !error"
        :title="t('command.outputState.noOutputYet')"
        :description="t('command.outputState.runCommandToSeeOutput')"
      />
      <t-empty
        v-else-if="result?.status === 'success' && !result.blocks.length && !error"
        :title="t('command.outputState.emptyOutput')"
        :description="t('command.outputState.completedWithoutOutput')"
      />
      <section v-for="(block, index) in result?.blocks ?? []" :key="index" class="content-block">
        <header>
          <t-tag size="small">{{
            block.type === "code"
              ? (block.language ?? t("command.outputState.code"))
              : t(`command.outputState.${block.type}`)
          }}</t-tag>
        </header>
        <dl v-if="block.type === 'properties'" class="property-list">
          <template v-for="(item, itemIndex) in block.items" :key="itemIndex">
            <dt>{{ label(item.label) }}</dt>
            <dd>
              {{ item.value === null ? "null" : String(item.value) }}
              <small v-if="item.note" class="muted">{{ label(item.note) }}</small>
            </dd>
          </template>
        </dl>
        <pre v-else :class="{ 'plain-text': block.type === 'text' }">{{
          block.type === "json" ? JSON.stringify(block.value, null, 2) : block.text
        }}</pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
.command-output {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
/* Bound long results inside the shared-height cards, not the card itself. */
.command-output:not(.output-centered) {
  max-height: 640px;
}
.command-output > * {
  flex-shrink: 0;
}
.command-output.output-centered {
  justify-content: center;
  align-items: center;
  text-align: center;
}
.content-block {
  min-width: 0;
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  overflow: hidden;
}
.content-block header {
  padding: 8px 12px;
  background: var(--td-bg-color-secondarycontainer);
}
pre {
  margin: 0;
  padding: 14px;
  max-height: none;
  overflow: auto;
  font:
    13px/1.6 "Cascadia Code",
    Consolas,
    monospace;
  background: var(--td-bg-color-secondarycontainer);
}
.plain-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: inherit;
  background: transparent;
}
.content-block .property-list {
  padding: 12px;
}
</style>
