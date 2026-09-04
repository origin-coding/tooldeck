<script setup lang="ts">
import { ref } from "vue";

import { validatePluginPackageDrop } from "@/renderer/features/plugins/package-drop";
import { pluginPath } from "@/renderer/utils/routes";

import type { PluginActions } from "../actions";
import { usePluginsStore } from "../store";

const props = defineProps<{
  blocked: boolean;
  busy: boolean;
  loading: boolean;
  actions: Pick<PluginActions, "install" | "rescan">;
}>();
const plugins = usePluginsStore();

const emit = defineEmits<{ done: [] }>();
const installedPluginId = ref<string>();
const attemptStarted = ref(false);
const { t } = useI18n();
const dragActive = ref(false);
const validationError = ref<string>();
async function drop(event: DragEvent) {
  dragActive.value = false;
  if (props.blocked) return;
  installedPluginId.value = undefined;
  attemptStarted.value = false;
  const validation = validatePluginPackageDrop(event.dataTransfer?.files ?? []);
  if (!validation.valid) {
    validationError.value = t(`plugin.install.validation.${validation.reason}`);
    return;
  }
  validationError.value = undefined;
  attemptStarted.value = true;
  installedPluginId.value = await props.actions.install(validation.file);
}
</script>

<template>
  <div class="plugin-install" @dragover.prevent @drop.prevent>
    <div
      class="drop-zone"
      :class="{ 'drag-active': dragActive, disabled: props.blocked }"
      role="region"
      :aria-label="t('plugin.install.dropAriaLabel')"
      :aria-disabled="props.blocked"
      @dragenter.prevent.stop="dragActive = !props.blocked"
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
        v-if="plugins.installState.status === 'installing'"
        :text="t('plugin.install.installing', { packageName: plugins.installState.packageName })"
      />
      <t-alert
        v-else-if="attemptStarted && plugins.installState.status === 'success'"
        theme="success"
        :message="t('plugin.install.success', { packageName: plugins.installState.packageName })"
      />
      <t-alert
        v-else-if="attemptStarted && plugins.installState.status === 'error'"
        theme="error"
        :title="t('plugin.install.failed')"
        :message="plugins.installState.message"
      />
      <t-alert
        v-else-if="plugins.installState.status === 'refresh-failed'"
        theme="warning"
        :title="t('plugin.install.refreshFailed')"
        :message="plugins.installState.message + ' ' + t('plugin.install.refreshFailedDescription')"
      >
        <template #operation>
          <t-button
            variant="text"
            :loading="props.loading"
            :disabled="props.busy"
            @click="props.actions.rescan()"
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

<style scoped>
.install-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}
.drop-zone {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px;
  border: 1px dashed var(--td-component-border);
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
  text-align: center;
}
.drop-zone.drag-active {
  border-color: var(--td-brand-color);
  background: var(--td-brand-color-light);
}
.drop-zone.disabled {
  opacity: 0.6;
}
.install-feedback:not(:empty) {
  margin-top: 14px;
}
</style>
