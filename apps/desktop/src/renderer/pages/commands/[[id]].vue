<script setup lang="ts">
import { computed } from "vue";

import { useWorkspaceActions } from "@/renderer/app/workspace";
import CommandWorkspace from "@/renderer/features/commands/components/CommandWorkspace.vue";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceActions();
const commandId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : undefined,
);
function showHistory(command: string) {
  void router.push({ path: "/history", query: { command } });
}
</script>
<template>
  <CommandWorkspace
    :command-id="commandId"
    :busy="workspace.busy"
    :blocked="workspace.blocked"
    @run="workspace.run"
    @history="showHistory"
  />
</template>
