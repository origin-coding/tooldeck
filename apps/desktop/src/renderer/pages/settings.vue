<script setup lang="ts">
import { useWorkspaceActions } from "@/renderer/app/workspace";
import PreferencesWorkspace from "@/renderer/features/preferences/components/PreferencesWorkspace.vue";

const workspace = useWorkspaceActions();
</script>
<template>
  <PreferencesWorkspace
    :blocked="workspace.blocked"
    :busy="workspace.busy"
    :loading="workspace.loading"
    @save="workspace.setPreference"
    @rescan="workspace.rescan"
  />
</template>
