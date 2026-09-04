<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import type { CommandRunRecord } from "@/shared/api";

const workspace = useWorkspaceStore();
const route = useRoute();
const { t, locale } = useI18n();
const commandId = computed(() =>
  typeof route.query.command === "string" ? route.query.command : undefined,
);
const selected = shallowRef<CommandRunRecord>();
const visible = ref(false);
watch(
  commandId,
  (id) => {
    selected.value = undefined;
    visible.value = false;
    void workspace.loadHistory(id);
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
            :loading="workspace.historyLoading"
            @click="workspace.loadHistory(commandId)"
            >{{ t("common.rescan") }}</t-button
          >
        </div></template
      >
      <t-alert v-if="workspace.historyError" theme="error" :message="workspace.historyError" />
      <t-loading v-if="workspace.historyLoading" :text="t('history.loading')" />
      <t-empty
        v-else-if="!workspace.history.length"
        :description="t(commandId ? 'history.emptyForCommand' : 'history.empty')"
      />
      <template v-else>
        <button
          v-for="run in workspace.history"
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
