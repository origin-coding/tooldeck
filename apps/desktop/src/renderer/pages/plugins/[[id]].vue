<script setup lang="ts">
import { computed } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { commandPath, pluginPath } from "@/renderer/utils/session";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const { t } = useI18n();
const plugin = computed(() => workspace.plugins.find((item) => item.id === route.params.id));
const commands = computed(() =>
  workspace.commands.filter((item) => item.pluginId === plugin.value?.id),
);
async function uninstall(id: string) {
  if (await workspace.uninstall(id)) await router.replace("/plugins");
}
</script>

<template>
  <div class="stack">
    <PluginInstall />
    <template v-if="plugin">
      <t-card :title="plugin.name">
        <template #actions>
          <div class="actions">
            <t-button
              variant="outline"
              :disabled="workspace.blocked"
              @click="workspace.setEnabled(plugin.id, !plugin.enabled)"
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
              <t-button theme="danger" variant="outline" :disabled="workspace.blocked">{{
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
          <dt>{{ t("plugin.runtime") }}</dt>
          <dd><DesktopStatus :status="plugin.enabled ? plugin.runtimeState : 'disabled'" /></dd>
          <dt>{{ t("common.commands") }}</dt>
          <dd>{{ plugin.commandCount }}</dd>
        </dl>
        <code class="manifest-path">{{ plugin.manifestPath }}</code>
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
    <t-card v-else :title="t('common.plugins')">
      <t-empty v-if="!workspace.plugins.length" :description="t('navigation.noPluginsFound')" />
      <NuxtLink
        v-for="item in workspace.plugins"
        :key="item.id"
        :to="pluginPath(item.id)"
        class="result-row"
        ><span
          ><strong>{{ item.name }}</strong
          ><small class="muted">{{ item.description ?? item.id }}</small></span
        ><DesktopStatus :status="item.enabled ? item.runtimeState : 'disabled'"
      /></NuxtLink>
    </t-card>
    <t-card v-if="workspace.residues.length" :title="t('plugin.retainedData.title')">
      <p class="muted">{{ t("plugin.retainedData.description") }}</p>
      <div v-for="residue in workspace.residues" :key="residue.pluginId" class="result-row">
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
          @confirm="workspace.purge(residue.pluginId)"
          ><t-button theme="danger" variant="text" :disabled="workspace.blocked">{{
            t("plugin.purge")
          }}</t-button></t-popconfirm
        >
      </div>
    </t-card>
  </div>
</template>
