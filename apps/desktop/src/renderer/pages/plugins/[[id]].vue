<script setup lang="ts">
import { computed } from "vue";

import { useWorkspaceActions } from "@/renderer/app/workspace";
import PluginsWorkspace from "@/renderer/features/plugins/components/PluginsWorkspace.vue";

const workspace = useWorkspaceActions();
const route = useRoute();
const router = useRouter();
const pluginId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : undefined,
);
</script>
<template>
  <PluginsWorkspace
    :plugin-id="pluginId"
    :actions="workspace"
    :blocked="workspace.blocked"
    :busy="workspace.busy"
    :loading="workspace.loading"
    @uninstalled="router.replace('/plugins')"
  />
</template>
