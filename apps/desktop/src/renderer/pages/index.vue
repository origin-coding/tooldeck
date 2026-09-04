<script setup lang="ts">
import { onMounted } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { readDesktopSession, commandPath, pluginPath } from "@/renderer/utils/session";

const workspace = useWorkspaceStore();
const router = useRouter();
onMounted(() => {
  const saved = readDesktopSession().path;
  const fallback =
    workspace.navigationMode === "entry-first" && workspace.commands[0]
      ? commandPath(workspace.commands[0].id)
      : workspace.plugins[0]
        ? pluginPath(workspace.plugins[0].id)
        : "/plugins";
  void router.replace(saved ?? fallback);
});
</script>
<template><div /></template>
