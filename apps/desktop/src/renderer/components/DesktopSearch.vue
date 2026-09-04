<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, ref, watch } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { commandPath, pluginPath } from "@/renderer/utils/session";

const visible = defineModel<boolean>("visible", { default: false });
const workspace = useWorkspaceStore();
const router = useRouter();
const { t } = useI18n();
const query = ref("");
const scope = ref("all");
const records = computed(() =>
  [
    ...workspace.commands.map((command) => ({
      kind: "commands",
      id: command.id,
      title: command.title,
      description: command.description,
      pluginId: command.pluginId,
      pluginName: workspace.plugins.find((plugin) => plugin.id === command.pluginId)?.name,
      searchText: command.searchText,
      path: commandPath(command.id),
    })),
    ...workspace.plugins.map((plugin) => ({
      kind: "plugins",
      id: plugin.id,
      title: plugin.name,
      description: plugin.description,
      pluginId: plugin.id,
      pluginName: plugin.name,
      searchText: plugin.searchText,
      path: pluginPath(plugin.id),
    })),
  ].filter((item) => scope.value === "all" || item.kind === scope.value),
);
const index = computed(
  () =>
    new Fuse(records.value, {
      keys: [
        { name: "title", weight: 4 },
        { name: "description", weight: 2 },
        { name: "id", weight: 2 },
        { name: "pluginId", weight: 1 },
        { name: "pluginName", weight: 1 },
        { name: "searchText", weight: 5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    }),
);
const results = computed(() =>
  query.value.trim()
    ? index.value.search(query.value.trim(), { limit: 40 }).map((item) => item.item)
    : records.value.slice(0, 40),
);
watch(visible, (open) => {
  if (!open) {
    query.value = "";
    scope.value = "all";
  }
});
function select(path: string) {
  visible.value = false;
  void router.push(path);
}
</script>

<template>
  <t-dialog v-model:visible="visible" :header="t('search.title')" :footer="false" width="720px">
    <div class="stack">
      <t-input
        v-model="query"
        autofocus
        clearable
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.placeholder')"
        @enter="results[0] && select(results[0].path)"
      />
      <t-radio-group :value="scope" variant="default-filled" @change="scope = String($event)">
        <t-radio-button v-for="item in ['all', 'commands', 'plugins']" :key="item" :value="item">{{
          t(`search.scope.${item}`)
        }}</t-radio-button>
      </t-radio-group>
      <div class="search-results">
        <t-empty v-if="!results.length" :description="t('search.noResults')" />
        <button
          v-for="item in results"
          :key="item.kind + item.id"
          type="button"
          class="result-row"
          @click="select(item.path)"
        >
          <span
            ><strong>{{ item.title }}</strong
            ><small class="muted">{{ item.description ?? item.id }}</small></span
          >
          <t-tag>{{
            item.kind === "plugins" ? t("search.kind.plugin") : (item.pluginName ?? item.pluginId)
          }}</t-tag>
        </button>
      </div>
    </div>
  </t-dialog>
</template>
