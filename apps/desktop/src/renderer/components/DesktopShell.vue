<script setup lang="ts">
import { computed, ref } from "vue";

import { useWorkspaceStore } from "@/renderer/stores/workspace";
import { commandPath, pluginPath } from "@/renderer/utils/session";

const workspace = useWorkspaceStore();
const route = useRoute();
const { t } = useI18n();
const searchOpen = ref(false);
const entries = computed(() =>
  workspace.navigationMode === "provider-first"
    ? workspace.plugins.map((plugin) => ({
        id: plugin.id,
        title: plugin.name,
        path: pluginPath(plugin.id),
      }))
    : workspace.commands.map((command) => ({
        id: command.id,
        title: command.title,
        path: commandPath(command.id),
      })),
);

function preventFileNavigation(event: DragEvent) {
  if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) event.preventDefault();
}
</script>

<template>
  <div
    class="desktop-shell"
    :class="{ 'sidebar-collapsed': workspace.collapsed }"
    @dragover="preventFileNavigation"
    @drop="preventFileNavigation"
  >
    <aside class="sidebar">
      <div class="sidebar-header">
        <t-tooltip
          :content="t(workspace.collapsed ? 'navigation.expandSidebar' : 'navigation.collapseSidebar')"
          placement="right"
        >
          <t-button
            variant="text"
            shape="square"
            :disabled="workspace.blocked"
            :aria-label="
              t(workspace.collapsed ? 'navigation.expandSidebar' : 'navigation.collapseSidebar')
            "
            :aria-expanded="!workspace.collapsed"
            aria-controls="desktop-navigation"
            @click="workspace.setPreference('desktop', 'sidebar.collapsed', !workspace.collapsed)"
          >
            <template #icon><view-list-icon /></template>
          </t-button>
        </t-tooltip>
        <NuxtLink v-show="!workspace.collapsed" to="/" class="brand">Tooldeck</NuxtLink>
      </div>
      <div class="sidebar-search">
        <t-tooltip
          :content="t('navigation.search')"
          :disabled="!workspace.collapsed"
          placement="right"
        >
          <t-button
            block
            variant="outline"
            :aria-label="t('navigation.search')"
            aria-haspopup="dialog"
            @click="searchOpen = true"
          >
            <template #icon><search-icon /></template>
            <span v-show="!workspace.collapsed">{{ t("navigation.search") }}</span>
          </t-button>
        </t-tooltip>
      </div>
      <nav
        id="desktop-navigation"
        class="catalog-nav"
        :aria-label="
          workspace.navigationMode === 'provider-first' ? t('common.plugins') : t('common.commands')
        "
      >
        <t-menu :value="route.path" :collapsed="workspace.collapsed" :width="[232, 64]">
          <t-menu-item
            v-for="entry in entries"
            :key="entry.path"
            :value="entry.path"
            :to="entry.path"
            router-link
          >
            <template #icon>
              <extension-icon v-if="workspace.navigationMode === 'provider-first'" />
              <tools-icon v-else />
            </template>
            {{ entry.title }}
          </t-menu-item>
          <li v-if="!entries.length && !workspace.collapsed" class="catalog-empty muted">
            {{
              t(
                workspace.navigationMode === "provider-first"
                  ? "navigation.noPluginsFound"
                  : "navigation.noCommandsFound",
              )
            }}
          </li>
        </t-menu>
      </nav>
      <nav class="footer-nav" :aria-label="t('navigation.management')">
        <t-menu :value="route.path" :collapsed="workspace.collapsed" :width="[232, 64]">
          <t-menu-item value="/plugins" to="/plugins" router-link>
            <template #icon><extension-icon /></template>{{ t("common.plugins") }}
          </t-menu-item>
          <t-menu-item value="/history" to="/history" router-link>
            <template #icon><history-icon /></template>{{ t("history.title") }}
          </t-menu-item>
          <t-menu-item value="/settings" to="/settings" router-link>
            <template #icon><setting-icon /></template>{{ t("common.settings") }}
          </t-menu-item>
        </t-menu>
      </nav>
    </aside>
    <div class="desktop-main">
      <main class="workspace stack">
        <t-alert
          v-if="workspace.error"
          theme="error"
          :title="t('shell.loadFailed')"
          :message="workspace.error"
        />
        <t-alert
          v-if="workspace.installState.status === 'refresh-failed'"
          theme="warning"
          :title="t('plugin.install.refreshFailed')"
          :message="
            workspace.installState.message + ' ' + t('plugin.install.refreshFailedDescription')
          "
        >
          <template #operation
            ><t-button
              size="small"
              :loading="workspace.loading"
              :disabled="workspace.busy"
              @click="workspace.rescan()"
              >{{ t("common.rescan") }}</t-button
            ></template
          >
        </t-alert>
        <t-alert
          v-if="workspace.cleanupWarning"
          theme="warning"
          :title="t('plugin.cleanupPending.title')"
          :message="
            t('plugin.cleanupPending.description', {
              count: workspace.cleanupWarning.count,
              step: workspace.cleanupWarning.step,
              message: workspace.cleanupWarning.message,
            })
          "
        />
        <template v-if="!workspace.initialized">
          <t-loading
            v-if="workspace.loading"
            :text="t('page.loadingWorkspace')"
            class="startup-loading"
          />
          <t-button v-else @click="workspace.initialize()">{{ t("common.rescan") }}</t-button>
        </template>
        <slot v-else />
      </main>
    </div>
    <DesktopSearch v-model:visible="searchOpen" />
  </div>
</template>
