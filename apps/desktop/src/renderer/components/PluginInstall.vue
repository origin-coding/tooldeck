<script setup lang="ts">
import { ref } from "vue";

import { validatePluginPackageDrop } from "@/renderer/components/plugins/plugin-package-drop";
import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { pluginPath } from "@/renderer/utils/session";

const workspace = useWorkspaceStore();
const router = useRouter();
const { t } = useI18n();
const dragActive = ref(false);
const validationError = ref<string>();
async function drop(event: DragEvent) {
  dragActive.value = false;
  if (workspace.blocked) return;
  const validation = validatePluginPackageDrop(event.dataTransfer?.files ?? []);
  if (!validation.valid) {
    validationError.value = t(`plugin.install.validation.${validation.reason}`);
    return;
  }
  validationError.value = undefined;
  const pluginId = await workspace.install(validation.file);
  if (pluginId) await router.push(pluginPath(pluginId));
}
</script>

<template>
  <t-card :title="t('plugin.install.title')">
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
        v-else-if="workspace.installState.status === 'success'"
        theme="success"
        :message="t('plugin.install.success', { packageName: workspace.installState.packageName })"
      />
      <t-alert
        v-else-if="workspace.installState.status === 'error'"
        theme="error"
        :title="t('plugin.install.failed')"
        :message="workspace.installState.message"
      />
    </div>
  </t-card>
</template>
