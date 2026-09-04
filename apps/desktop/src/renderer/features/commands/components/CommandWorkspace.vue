<script setup lang="ts">
import { computed } from "vue";

import { useCatalogStore } from "@/renderer/features/catalog/store";
import { pluginPath } from "@/renderer/utils/routes";

import { useCommandsStore } from "../store";
import CommandInput from "./CommandInput.vue";
import CommandPanel from "./CommandPanel.vue";
import CommandResult from "./CommandResult.vue";

const props = defineProps<{ commandId?: string; busy: boolean; blocked: boolean }>();
const emit = defineEmits<{ run: [commandId: string]; history: [commandId: string] }>();
const catalog = useCatalogStore();
const commandState = useCommandsStore();

const { t } = useI18n();
const command = computed(() => catalog.commands.find((item) => item.id === props.commandId));
const plugin = computed(() => catalog.plugins.find((item) => item.id === command.value?.pluginId));
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
          <t-button variant="text" @click="emit('history', command.id)">
            {{ t("command.history") }}
          </t-button>
          <t-button
            :disabled="blocked || !command.pluginEnabled"
            :loading="commandState.runningCommandId === command.id"
            @click="emit('run', command.id)"
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
        <CommandPanel :title="t('command.input')">
          <CommandInput
            :command="command"
            :draft="commandState.drafts[command.id]"
            :disabled="busy || !command.pluginEnabled"
            @change="(key, value) => commandState.setInput(command!.id, key, value)"
          />
        </CommandPanel>
        <CommandPanel :title="t('command.output')">
          <template #actions
            ><DesktopStatus
              v-if="
                commandState.results[command.id] && commandState.runningCommandId !== command.id
              "
              :status="commandState.results[command.id]!.status"
          /></template>
          <CommandResult
            :running="commandState.runningCommandId === command.id"
            :result="commandState.results[command.id]"
            :error="commandState.runErrors[command.id]"
          />
        </CommandPanel>
      </div>
    </template>
    <t-empty v-else :title="t('command.empty.title')" :description="t('command.empty.choose')" />
  </div>
</template>

<style scoped>
.page-heading {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.page-heading p {
  margin: 8px 0 4px;
}
.page-heading > a {
  display: inline-block;
  margin-top: 4px;
  font-size: 13px;
}

.command-panels {
  display: grid;
  align-items: stretch;
  gap: 18px;
}
.command-panels.split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.command-panels > * {
  min-width: 0;
}

@media (max-width: 1050px) {
  .command-panels.split {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
