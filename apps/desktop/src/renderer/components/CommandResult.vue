<script setup lang="ts">
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";
defineProps<{ result?: CommandResult; error?: string }>();
const { t } = useI18n();
function label(value: LocalizedString) {
  return typeof value === "string" ? value : value.default;
}
</script>

<template>
  <div class="stack command-output">
    <t-alert v-if="error" theme="error" :title="t('command.runFailed')" :message="error" />
    <t-alert
      v-if="result?.status === 'error'"
      theme="error"
      :title="t('command.outputState.commandFailed')"
      :message="result.error?.message ?? t('command.outputState.errorResult')"
    />
    <t-empty
      v-if="!result"
      :description="
        t(
          error
            ? 'command.outputState.commandDidNotReturnOutput'
            : 'command.outputState.runCommandToSeeOutput',
        )
      "
    />
    <t-empty
      v-else-if="!result.blocks.length"
      :description="
        t(
          result.status === 'error'
            ? 'command.outputState.errorWithoutOutput'
            : 'command.outputState.completedWithoutOutput',
        )
      "
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
  </div>
</template>
