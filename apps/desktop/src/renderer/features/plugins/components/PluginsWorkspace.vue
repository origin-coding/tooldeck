<script setup lang="ts">
import { computed, ref } from "vue";

import { useCatalogStore } from "@/renderer/features/catalog/store";
import { commandPath, pluginPath } from "@/renderer/utils/routes";

import type { PluginActions } from "../actions";
import { usePluginsStore } from "../store";
import PluginInstall from "./PluginInstall.vue";

const props = defineProps<{
  pluginId?: string;
  blocked: boolean;
  busy: boolean;
  loading: boolean;
  actions: PluginActions;
}>();
const emit = defineEmits<{ uninstalled: [] }>();
const catalog = useCatalogStore();
const plugins = usePluginsStore();

const { t } = useI18n();
const installOpen = ref(false);
const plugin = computed(() => catalog.plugins.find((item) => item.id === props.pluginId));
const commands = computed(() =>
  catalog.commands.filter((item) => item.pluginId === plugin.value?.id),
);
async function uninstall(id: string) {
  if (await props.actions.uninstall(id)) emit("uninstalled");
}
</script>

<template>
  <div class="stack">
    <t-alert v-if="plugins.error" theme="error" :message="plugins.error" />
    <header class="page-toolbar">
      <NuxtLink v-if="plugin" to="/plugins" class="back-link">
        <chevron-left-icon />{{ t("plugin.backToList") }}
      </NuxtLink>
      <h1 v-else>{{ t("common.plugins") }}</h1>
      <t-button v-if="!plugin" :disabled="props.blocked" @click="installOpen = true">
        <template #icon><add-icon /></template>{{ t("plugin.install.title") }}
      </t-button>
    </header>
    <template v-if="plugin">
      <t-card :title="plugin.name">
        <template #actions>
          <div class="actions">
            <t-button
              variant="outline"
              :disabled="props.blocked"
              @click="props.actions.setEnabled(plugin.id, !plugin.enabled)"
              >{{ t(plugin.enabled ? "plugin.disable" : "plugin.enable") }}</t-button
            >
            <t-popconfirm
              v-if="plugin.sourceKind === 'installed'"
              :content="t('plugin.uninstallConfirmDescription', { pluginId: plugin.id })"
              :confirm-btn="t('plugin.uninstall')"
              :cancel-btn="t('plugin.cancel')"
              theme="warning"
              @confirm="uninstall(plugin.id)"
            >
              <t-button theme="danger" variant="outline" :disabled="props.blocked">{{
                t("plugin.uninstall")
              }}</t-button>
            </t-popconfirm>
          </div>
        </template>
        <p v-if="plugin.description">{{ plugin.description }}</p>
        <dl class="property-list">
          <dt>{{ t("plugin.version") }}</dt>
          <dd>{{ plugin.version }}</dd>
          <dt>{{ t("plugin.source") }}</dt>
          <dd>{{ t(`plugin.sourceKind.${plugin.sourceKind}`) }}</dd>
          <dt>{{ t("plugin.state") }}</dt>
          <dd>{{ t(plugin.enabled ? "plugin.enabled" : "status.disabled") }}</dd>
          <dt>{{ t("common.commands") }}</dt>
          <dd>{{ plugin.commandCount }}</dd>
        </dl>
        <details class="plugin-details">
          <summary>{{ t("plugin.details") }}</summary>
          <dl class="property-list">
            <dt>{{ t("plugin.runtime") }}</dt>
            <dd><DesktopStatus :status="plugin.enabled ? plugin.runtimeState : 'disabled'" /></dd>
            <dt>{{ t("plugin.manifestPath") }}</dt>
            <dd>
              <code>{{ plugin.manifestPath }}</code>
            </dd>
          </dl>
        </details>
      </t-card>
      <t-card :title="t('plugin.contributedCommands')">
        <p class="muted">{{ t("plugin.contributedCommandsDescription") }}</p>
        <t-empty v-if="!commands.length" :description="t('plugin.noCommandsContributed')" />
        <NuxtLink
          v-for="command in commands"
          :key="command.id"
          :to="commandPath(command.id)"
          class="result-row"
          ><span
            ><strong>{{ command.title }}</strong
            ><small class="muted">{{ command.description ?? command.id }}</small></span
          ><chevron-right-icon
        /></NuxtLink>
      </t-card>
    </template>
    <t-card v-else>
      <t-empty v-if="!catalog.plugins.length" :description="t('navigation.noPluginsFound')" />
      <NuxtLink
        v-for="item in catalog.plugins"
        :key="item.id"
        :to="pluginPath(item.id)"
        class="result-row"
        ><span
          ><strong>{{ item.name }}</strong
          ><small class="muted">{{ item.description ?? item.id }}</small></span
        ><DesktopStatus :status="item.enabled ? item.runtimeState : 'disabled'"
      /></NuxtLink>
    </t-card>
    <t-card v-if="!plugin && plugins.residues.length" :title="t('plugin.retainedData.title')">
      <p class="muted">{{ t("plugin.retainedData.description") }}</p>
      <div v-for="residue in plugins.residues" :key="residue.pluginId" class="result-row">
        <span
          ><strong>{{ residue.pluginId }}</strong
          ><small class="muted">{{
            t("plugin.retainedData.summary", {
              state: t(
                residue.statePresent
                  ? "plugin.retainedData.statePresent"
                  : "plugin.retainedData.stateAbsent",
              ),
              kvEntries: residue.kvEntries,
            })
          }}</small></span
        >
        <t-popconfirm
          :content="t('plugin.retainedData.confirmDescription', { pluginId: residue.pluginId })"
          :confirm-btn="t('plugin.purge')"
          :cancel-btn="t('plugin.cancel')"
          theme="warning"
          @confirm="props.actions.purge(residue.pluginId)"
          ><t-button theme="danger" variant="text" :disabled="props.blocked">{{
            t("plugin.purge")
          }}</t-button></t-popconfirm
        >
      </div>
    </t-card>
    <DesktopDialog
      v-model:visible="installOpen"
      :header="t('plugin.install.title')"
      :footer="false"
      width="min(640px, calc(100vw - 32px))"
      placement="center"
      dialog-class-name="install-dialog"
      destroy-on-close
      :close-btn="plugins.installState.status !== 'installing'"
      :close-on-esc-keydown="plugins.installState.status !== 'installing'"
      :close-on-overlay-click="false"
    >
      <PluginInstall
        :actions="actions"
        :blocked="blocked"
        :busy="busy"
        :loading="loading"
        @done="installOpen = false"
      />
    </DesktopDialog>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.plugin-details {
  margin-top: 16px;
}
.plugin-details summary {
  color: var(--td-text-color-secondary);
  cursor: pointer;
}
</style>
