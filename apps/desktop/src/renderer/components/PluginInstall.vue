<script setup lang="ts">
import { ref } from "vue";

import { validatePluginPackageDrop } from "@/renderer/components/plugins/plugin-package-drop";
import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { pluginPath } from "@/renderer/utils/session";

const workspace = useWorkspaceStore();
const emit = defineEmits<{ done: [] }>();
const installedPluginId = ref<string>();
const attemptStarted = ref(false);
const { t } = useI18n();
const dragActive = ref(false);
const validationError = ref<string>();
async function drop(event: DragEvent) {
  dragActive.value = false;
  if (workspace.blocked) return;
  installedPluginId.value = undefined;
  attemptStarted.value = false;
  const validation = validatePluginPackageDrop(event.dataTransfer?.files ?? []);
  if (!validation.valid) {
    validationError.value = t(`plugin.install.validation.${validation.reason}`);
    return;
  }
  validationError.value = undefined;
  attemptStarted.value = true;
  installedPluginId.value = await workspace.install(validation.file);
}
</script>

<template>
  <div class="plugin-install" @dragover.prevent @drop.prevent>
    <div
      class="drop-zone"
      :class="{ 'drag-active': dragActive, disabled: workspace.blocked }"
      role="region"
      :aria-label="t('plugin.install.dropAriaLabel')"
      :aria-disabled="workspace.blocked"
      @dragenter.prevent.stop="dragActive = !workspace.blocked"
      @dragover.prevent.stop
      @dragleave.prevent.stop="dragActive = false"
      @drop.prevent.stop="drop"
    >
      <download-icon size="28" /><strong>{{ t("plugin.install.dropTitle") }}</strong
      ><small class="muted">{{ t("plugin.install.dropDescription") }}</small>
    </div>
    <div aria-live="polite" class="install-feedback">
      <t-alert v-if="validationError" theme="error" :message="validationError" />
      <t-loading
        v-if="workspace.installState.status === 'installing'"
        :text="t('plugin.install.installing', { packageName: workspace.installState.packageName })"
      />
      <t-alert
        v-else-if="attemptStarted && workspace.installState.status === 'success'"
        theme="success"
        :message="t('plugin.install.success', { packageName: workspace.installState.packageName })"
      />
      <t-alert
        v-else-if="attemptStarted && workspace.installState.status === 'error'"
        theme="error"
        :title="t('plugin.install.failed')"
        :message="workspace.installState.message"
      />
      <t-alert
        v-else-if="workspace.installState.status === 'refresh-failed'"
        theme="warning"
        :title="t('plugin.install.refreshFailed')"
        :message="
          workspace.installState.message + ' ' + t('plugin.install.refreshFailedDescription')
        "
      >
        <template #operation>
          <t-button
            variant="text"
            :loading="workspace.loading"
            :disabled="workspace.busy"
            @click="workspace.rescan()"
          >
            {{ t("common.rescan") }}
          </t-button>
        </template>
      </t-alert>
    </div>
    <div v-if="installedPluginId" class="install-actions">
      <NuxtLink :to="pluginPath(installedPluginId)" @click="emit('done')">{{
        t("plugin.install.viewPlugin")
      }}</NuxtLink>
    </div>
  </div>
</template>
