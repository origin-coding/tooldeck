<script setup lang="ts">
import { onMounted } from "vue";

import { useCatalogStore } from "@/renderer/features/catalog/store";
import { usePreferencesStore } from "@/renderer/features/preferences/store";
import { commandPath, pluginPath } from "@/renderer/utils/routes";
import { readDesktopSession } from "@/renderer/utils/session";

const catalog = useCatalogStore();
const preferences = usePreferencesStore();

const router = useRouter();
onMounted(() => {
  const saved = readDesktopSession().path;
  const fallback =
    preferences.navigationMode === "entry-first" && catalog.commands[0]
      ? commandPath(catalog.commands[0].id)
      : catalog.plugins[0]
        ? pluginPath(catalog.plugins[0].id)
        : "/plugins";
  void router.replace(saved ?? fallback);
});
</script>
<template><div /></template>
