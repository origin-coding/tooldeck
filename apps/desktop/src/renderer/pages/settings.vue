<script setup lang="ts">
import { computed } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";

const workspace = useWorkspaceStore();
const { t } = useI18n();
const localeValue = computed(() => {
  const value = workspace.preference("shared", "locale");
  return value === "en-US" || value === "zh-CN" ? value : "system";
});
</script>

<template>
  <div class="stack">
    <t-card :title="t('settings.preferences.title')">
      <p class="muted">{{ t("settings.preferences.description") }}</p>
      <div class="setting-row">
        <div>
          <h3>{{ t("settings.locale.label") }}</h3>
          <p class="muted">{{ t("settings.locale.description") }}</p>
        </div>
        <t-select
          :value="localeValue"
          :disabled="workspace.blocked"
          :aria-label="t('settings.locale.label')"
          :options="[
            { value: 'system', label: t('common.system') },
            { value: 'en-US', label: t('common.english') },
            { value: 'zh-CN', label: t('common.chineseSimplified') },
          ]"
          @change="workspace.setPreference('shared', 'locale', $event)"
        />
      </div>
      <div class="setting-row">
        <div>
          <h3>{{ t("settings.navigationMode.label") }}</h3>
          <p class="muted">
            {{
              t(
                workspace.navigationMode === "provider-first"
                  ? "settings.navigationMode.providerFirstDescription"
                  : "settings.navigationMode.entryFirstDescription",
              )
            }}
          </p>
        </div>
        <t-radio-group
          :value="workspace.navigationMode"
          :disabled="workspace.blocked"
          :aria-label="t('settings.navigationMode.label')"
          @change="workspace.setPreference('desktop', 'navigation.mode', $event)"
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
          :value="workspace.collapsed"
          :disabled="workspace.blocked"
          :aria-label="t('settings.sidebarCollapsed.label')"
          @change="workspace.setPreference('desktop', 'sidebar.collapsed', $event)"
        />
      </div>
    </t-card>
    <t-card :title="t('settings.workspace.title')">
      <template #actions
        ><t-tooltip :content="t('settings.workspace.rescanTooltip')"
          ><t-button
            variant="outline"
            :disabled="workspace.busy"
            :loading="workspace.loading"
            @click="workspace.rescan()"
            >{{ t("common.rescan") }}</t-button
          ></t-tooltip
        ></template
      >
      <p class="muted">{{ t("settings.workspace.description") }}</p>
      <div class="metrics">
        <NuxtLink to="/plugins" class="metric"
          ><span>{{ t("common.plugins") }}</span
          ><strong>{{ workspace.plugins.length }}</strong></NuxtLink
        >
        <div class="metric">
          <span>{{ t("common.commands") }}</span
          ><strong>{{ workspace.commands.length }}</strong>
        </div>
        <NuxtLink to="/history" class="metric"
          ><span>{{ t("settings.workspace.recentRuns") }}</span
          ><strong>{{ workspace.recentRunCount }}</strong></NuxtLink
        >
      </div>
    </t-card>
  </div>
</template>
