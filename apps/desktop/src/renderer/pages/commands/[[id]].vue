<script setup lang="ts">
import { computed } from "vue";

import { getInputFields } from "@/renderer/app/command-input";
import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { pluginPath } from "@/renderer/utils/session";

const route = useRoute();
const workspace = useWorkspaceStore();
const { t } = useI18n();
const command = computed(() => workspace.commands.find((item) => item.id === route.params.id));
const fields = computed(() => getInputFields(command.value));
const plugin = computed(() =>
  workspace.plugins.find((item) => item.id === command.value?.pluginId),
);
</script>

<template>
  <div class="stack">
    <template v-if="command">
      <t-card :title="command.title">
        <template #actions
          ><div class="actions">
            <NuxtLink :to="{ path: '/history', query: { command: command.id } }">{{
              t("command.history")
            }}</NuxtLink
            ><t-button
              :disabled="workspace.blocked || !command.pluginEnabled"
              :loading="workspace.runningCommandId === command.id"
              @click="workspace.run(command.id)"
              ><template #icon><play-icon /></template>{{ t("common.run") }}</t-button
            >
          </div></template
        >
        <p v-if="command.description">{{ command.description }}</p>
        <NuxtLink :to="pluginPath(command.pluginId)">{{
          t("command.sourceLine", {
            pluginName: plugin?.name ?? command.pluginId,
            commandTitle: command.title,
          })
        }}</NuxtLink>
      </t-card>
      <t-alert
        v-if="!command.pluginEnabled"
        theme="warning"
        :title="t('command.pluginDisabled.title')"
        :message="
          t('command.pluginDisabled.description', { pluginName: plugin?.name ?? command.pluginId })
        "
      />
      <div class="command-panels" :class="{ split: command['x-ui']?.layout === 'split' }">
        <t-card :title="t('command.input')">
          <div class="stack">
            <t-empty v-if="!fields.length" :description="t('command.form.noInputRequired')" />
            <CommandField
              v-for="field in fields"
              :key="command.id + ':' + field.key"
              :field="field"
              :value="workspace.drafts[command.id]?.[field.key]"
              :disabled="workspace.busy || !command.pluginEnabled"
              @change="workspace.setInput(command.id, field.key, $event)"
            />
          </div>
        </t-card>
        <t-card :title="t('command.output')">
          <template #actions
            ><DesktopStatus
              v-if="workspace.results[command.id]"
              :status="workspace.results[command.id]!.status"
          /></template>
          <CommandResult
            :result="workspace.results[command.id]"
            :error="workspace.runErrors[command.id]"
          />
        </t-card>
      </div>
    </template>
    <t-empty v-else :title="t('command.empty.title')" :description="t('command.empty.choose')" />
  </div>
</template>
