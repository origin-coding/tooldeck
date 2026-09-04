<script setup lang="ts">
import { computed } from "vue";

import { useCatalogStore } from "@/renderer/features/catalog/store";
import { useHistoryStore } from "@/renderer/features/history/store";
import type { DesktopPreferenceScope } from "@/shared/api";

import { usePreferencesStore } from "../store";

defineProps<{ blocked: boolean; busy: boolean; loading: boolean }>();
const emit = defineEmits<{
  save: [scope: DesktopPreferenceScope, key: string, value: unknown];
  rescan: [];
}>();
const preferences = usePreferencesStore();
const catalog = useCatalogStore();
const history = useHistoryStore();

const { t } = useI18n();
const localeValue = computed(() => {
  const value = preferences.preference("shared", "locale");
  return value === "en-US" || value === "zh-CN" ? value : "system";
});
</script>

<template>
  <div class="stack">
    <t-alert v-if="preferences.error" theme="error" :message="preferences.error" />
    <t-card :title="t('settings.preferences.title')">
      <p class="muted">{{ t("settings.preferences.description") }}</p>
      <div class="setting-row">
        <div>
          <h3>{{ t("settings.locale.label") }}</h3>
          <p class="muted">{{ t("settings.locale.description") }}</p>
        </div>
        <t-select
          :value="localeValue"
          :disabled="blocked"
          :aria-label="t('settings.locale.label')"
          :options="[
            { value: 'system', label: t('common.system') },
            { value: 'en-US', label: t('common.english') },
            { value: 'zh-CN', label: t('common.chineseSimplified') },
          ]"
          @change="emit('save', 'shared', 'locale', $event)"
        />
      </div>
      <div class="setting-row">
        <div>
          <h3>{{ t("settings.navigationMode.label") }}</h3>
          <p class="muted">
            {{
              t(
                preferences.navigationMode === "provider-first"
                  ? "settings.navigationMode.providerFirstDescription"
                  : "settings.navigationMode.entryFirstDescription",
              )
            }}
          </p>
        </div>
        <t-radio-group
          :value="preferences.navigationMode"
          :disabled="blocked"
          :aria-label="t('settings.navigationMode.label')"
          @change="emit('save', 'desktop', 'navigation.mode', $event)"
        >
          <t-radio-button value="provider-first">{{
            t("settings.navigationMode.providerFirst")
          }}</t-radio-button
          ><t-radio-button value="entry-first">{{
            t("settings.navigationMode.entryFirst")
          }}</t-radio-button>
        </t-radio-group>
      </div>
      <div class="setting-row">
        <div>
          <h3>{{ t("settings.sidebarCollapsed.label") }}</h3>
          <p class="muted">{{ t("settings.sidebarCollapsed.description") }}</p>
        </div>
        <t-switch
          :value="preferences.collapsed"
          :disabled="blocked"
          :aria-label="t('settings.sidebarCollapsed.label')"
          @change="emit('save', 'desktop', 'sidebar.collapsed', $event)"
        />
      </div>
    </t-card>
    <t-card :title="t('settings.workspace.title')">
      <template #actions
        ><t-tooltip :content="t('settings.workspace.rescanTooltip')"
          ><t-button
            variant="outline"
            :disabled="busy"
            :loading="loading"
            @click="emit('rescan')"
            >{{ t("common.rescan") }}</t-button
          ></t-tooltip
        ></template
      >
      <p class="muted">{{ t("settings.workspace.description") }}</p>
      <div class="metrics">
        <NuxtLink to="/plugins" class="metric"
          ><span>{{ t("common.plugins") }}</span
          ><strong>{{ catalog.plugins.length }}</strong></NuxtLink
        >
        <div class="metric">
          <span>{{ t("common.commands") }}</span
          ><strong>{{ catalog.commands.length }}</strong>
        </div>
        <NuxtLink to="/history" class="metric"
          ><span>{{ t("settings.workspace.recentRuns") }}</span
          ><strong>{{ history.recentRunCount }}</strong></NuxtLink
        >
      </div>
    </t-card>
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 0;
  border-bottom: 1px solid var(--td-component-stroke);
}
.setting-row:last-child {
  border: 0;
  padding-bottom: 0;
}
.setting-row p {
  margin: 6px 0 0;
}
.setting-row > :deep(.t-select__wrap) {
  width: 200px;
  flex-shrink: 0;
}
.setting-row > :deep(.t-radio-group) {
  flex-shrink: 0;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.metric {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  color: var(--td-text-color-secondary);
}
.metric strong {
  font-size: 26px;
  color: var(--td-text-color-primary);
}

@media (max-width: 1050px) {
  .setting-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
