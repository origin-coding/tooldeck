<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";

import type { CommandRunRecord } from "@/shared/api";

import { useHistoryStore } from "../store";

const props = defineProps<{ commandId?: string }>();
const history = useHistoryStore();

const { t, locale } = useI18n();
const selected = shallowRef<CommandRunRecord>();
const visible = ref(false);
watch(
  () => props.commandId,
  (id) => {
    selected.value = undefined;
    visible.value = false;
    void history.load(id);
  },
  { immediate: true },
);
function show(run: CommandRunRecord) {
  selected.value = run;
  visible.value = true;
}
function date(value: number) {
  return new Date(value).toLocaleString(locale.value);
}
function json(value: unknown) {
  return value === undefined ? t("common.undefined") : JSON.stringify(value, null, 2);
}
</script>

<template>
  <div class="stack">
    <t-card :title="commandId ? t('history.titleFor', { commandId }) : t('history.title')">
      <template #actions
        ><div class="actions">
          <NuxtLink v-if="commandId" to="/history">{{ t("common.all") }}</NuxtLink
          ><t-button
            variant="outline"
            :loading="history.loading"
            @click="history.load(commandId)"
            >{{ t("common.rescan") }}</t-button
          >
        </div></template
      >
      <t-alert v-if="history.error" theme="error" :message="history.error" />
      <t-loading v-if="history.loading" :text="t('history.loading')" />
      <t-empty
        v-else-if="!history.history.length"
        :description="t(commandId ? 'history.emptyForCommand' : 'history.empty')"
      />
      <template v-else>
        <button
          v-for="run in history.history"
          :key="run.id"
          type="button"
          class="result-row"
          @click="show(run)"
        >
          <span
            ><strong>{{ run.commandId }}</strong
            ><small class="muted"
              >{{ run.pluginId ?? t("history.unknownPlugin") }} · {{ run.source }} ·
              {{ date(run.createdAt) }}</small
            ></span
          >
          <span class="actions"
            ><small>{{ run.durationMs === undefined ? "—" : `${run.durationMs} ms` }}</small
            ><DesktopStatus :status="run.status"
          /></span>
        </button>
      </template>
    </t-card>
    <t-drawer
      v-model:visible="visible"
      :header="t('history.detailsTitle')"
      :footer="false"
      size="min(720px, 90vw)"
    >
      <div v-if="selected" class="stack">
        <dl class="property-list">
          <dt>{{ t("history.runId") }}</dt>
          <dd>{{ selected.id }}</dd>
          <dt>{{ t("history.commandId") }}</dt>
          <dd>{{ selected.commandId }}</dd>
          <dt>{{ t("history.pluginId") }}</dt>
          <dd>{{ selected.pluginId ?? t("history.unknownPlugin") }}</dd>
          <dt>{{ t("history.source") }}</dt>
          <dd>{{ selected.source }}</dd>
          <dt>{{ t("history.status") }}</dt>
          <dd><DesktopStatus :status="selected.status" /></dd>
          <dt>{{ t("history.duration") }}</dt>
          <dd>{{ selected.durationMs === undefined ? "—" : `${selected.durationMs} ms` }}</dd>
          <dt>{{ t("history.createdAt") }}</dt>
          <dd>{{ date(selected.createdAt) }}</dd>
        </dl>
        <section>
          <h3>{{ t("history.inputJson") }}</h3>
          <pre>{{ json(selected.input) }}</pre>
        </section>
        <section>
          <h3>{{ t("history.output") }}</h3>
          <pre>{{ json(selected.output) }}</pre>
        </section>
        <section>
          <h3>{{ t("history.error") }}</h3>
          <pre>{{ json(selected.error) }}</pre>
        </section>
      </div>
    </t-drawer>
  </div>
</template>

<style scoped>
pre {
  margin: 0;
  padding: 14px;
  max-height: 440px;
  overflow: auto;
  font:
    13px/1.6 "Cascadia Code",
    Consolas,
    monospace;
  background: var(--td-bg-color-secondarycontainer);
}
</style>
