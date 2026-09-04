<script setup lang="ts">
import { computed } from "vue";

import { getInputFields } from "@/renderer/app/command-input";
import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { pluginPath } from "@/renderer/utils/session";

const route = useRoute();
const router = useRouter();
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
      <header class="page-toolbar">
        <div class="page-heading">
          <h1>{{ command.title }}</h1>
          <p v-if="command.description" class="muted">{{ command.description }}</p>
          <NuxtLink :to="pluginPath(command.pluginId)">{{
            plugin?.name ?? command.pluginId
          }}</NuxtLink>
        </div>
        <div class="actions">
          <t-button
            variant="text"
            @click="router.push({ path: '/history', query: { command: command.id } })"
          >
            {{ t("command.history") }}
          </t-button>
          <t-button
            :disabled="workspace.blocked || !command.pluginEnabled"
            :loading="workspace.runningCommandId === command.id"
            @click="workspace.run(command.id)"
          >
            <template #icon><play-icon /></template>{{ t("common.run") }}
          </t-button>
        </div>
      </header>
      <t-alert
        v-if="!command.pluginEnabled"
        theme="warning"
        :title="t('command.pluginDisabled.title')"
        :message="
          t('command.pluginDisabled.description', { pluginName: plugin?.name ?? command.pluginId })
        "
      />
      <div class="command-panels" :class="{ split: command['x-ui']?.layout === 'split' }">
        <t-card :title="t('command.input')" class="command-card">
          <div class="stack input-form" :class="{ 'input-empty': !fields.length }">
            <t-empty
              v-if="!fields.length"
              :title="t('command.form.noInputRequired')"
              description=""
            />
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
        <t-card :title="t('command.output')" class="command-card output-card">
          <template #actions
            ><DesktopStatus
              v-if="
                workspace.results[command.id] && workspace.runningCommandId !== command.id
              "
              :status="workspace.results[command.id]!.status"
          /></template>
          <CommandResult
            :running="workspace.runningCommandId === command.id"
            :result="workspace.results[command.id]"
            :error="workspace.runErrors[command.id]"
          />
        </t-card>
      </div>
    </template>
    <t-empty v-else :title="t('command.empty.title')" :description="t('command.empty.choose')" />
  </div>
</template>
