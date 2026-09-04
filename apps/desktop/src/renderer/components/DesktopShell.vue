<script setup lang="ts">
import { computed, ref } from "vue";

import { useWorkspaceActions } from "@/renderer/app/workspace";
import { useCatalogStore } from "@/renderer/features/catalog/store";
import { usePluginsStore } from "@/renderer/features/plugins/store";
import { usePreferencesStore } from "@/renderer/features/preferences/store";
import DesktopSearch from "@/renderer/features/search/components/DesktopSearch.vue";
import { commandPath, pluginPath } from "@/renderer/utils/routes";

const workspace = useWorkspaceActions();
const catalog = useCatalogStore();
const plugins = usePluginsStore();
const preferences = usePreferencesStore();

const route = useRoute();
const { t } = useI18n();
const searchOpen = ref(false);
const entries = computed(() =>
  preferences.navigationMode === "provider-first"
    ? catalog.plugins.map((plugin) => ({
        id: plugin.id,
        title: plugin.name,
        path: pluginPath(plugin.id),
      }))
    : catalog.commands.map((command) => ({
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
    :class="{ 'sidebar-collapsed': preferences.collapsed }"
    @dragover="preventFileNavigation"
    @drop="preventFileNavigation"
  >
    <aside class="sidebar">
      <div class="sidebar-header">
        <t-tooltip
          :content="
            t(preferences.collapsed ? 'navigation.expandSidebar' : 'navigation.collapseSidebar')
          "
          placement="right"
        >
          <t-button
            variant="text"
            shape="square"
            :disabled="workspace.blocked"
            :aria-label="
              t(preferences.collapsed ? 'navigation.expandSidebar' : 'navigation.collapseSidebar')
            "
            :aria-expanded="!preferences.collapsed"
            aria-controls="desktop-navigation"
            @click="workspace.setPreference('desktop', 'sidebar.collapsed', !preferences.collapsed)"
          >
            <template #icon><view-list-icon /></template>
          </t-button>
        </t-tooltip>
        <NuxtLink v-show="!preferences.collapsed" to="/" class="brand">Tooldeck</NuxtLink>
      </div>
      <div class="sidebar-search">
        <t-tooltip
          :content="t('navigation.search')"
          :disabled="!preferences.collapsed"
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
            <span v-show="!preferences.collapsed">{{ t("navigation.search") }}</span>
          </t-button>
        </t-tooltip>
      </div>
      <nav
        id="desktop-navigation"
        class="catalog-nav"
        :aria-label="
          preferences.navigationMode === 'provider-first'
            ? t('common.plugins')
            : t('common.commands')
        "
      >
        <t-menu :value="route.path" :collapsed="preferences.collapsed" :width="[232, 64]">
          <t-menu-item
            v-for="entry in entries"
            :key="entry.path"
            :value="entry.path"
            :to="entry.path"
            router-link
          >
            <template #icon>
              <extension-icon v-if="preferences.navigationMode === 'provider-first'" />
              <tools-icon v-else />
            </template>
            {{ entry.title }}
          </t-menu-item>
          <li v-if="!entries.length && !preferences.collapsed" class="catalog-empty muted">
            {{
              t(
                preferences.navigationMode === "provider-first"
                  ? "navigation.noPluginsFound"
                  : "navigation.noCommandsFound",
              )
            }}
          </li>
        </t-menu>
      </nav>
      <nav class="footer-nav" :aria-label="t('navigation.management')">
        <t-menu :value="route.path" :collapsed="preferences.collapsed" :width="[232, 64]">
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
          v-if="plugins.installState.status === 'refresh-failed'"
          theme="warning"
          :title="t('plugin.install.refreshFailed')"
          :message="
            plugins.installState.message + ' ' + t('plugin.install.refreshFailedDescription')
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
          v-if="plugins.cleanupWarning"
          theme="warning"
          :title="t('plugin.cleanupPending.title')"
          :message="
            t('plugin.cleanupPending.description', {
              count: plugins.cleanupWarning.count,
              step: plugins.cleanupWarning.step,
              message: plugins.cleanupWarning.message,
            })
          "
        />
        <t-alert
          v-if="preferences.error && route.path !== '/settings'"
          theme="error"
          :message="preferences.error"
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

<style scoped>
.desktop-shell {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  transition: grid-template-columns 0.28s cubic-bezier(0.645, 0.045, 0.355, 1);
}
.desktop-shell.sidebar-collapsed {
  grid-template-columns: 64px minmax(0, 1fr);
}
.sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--td-bg-color-container);
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 16px;
  flex-shrink: 0;
  white-space: nowrap;
}
.sidebar-header :deep(.t-button) {
  flex-shrink: 0;
}
.brand {
  color: var(--td-text-color-primary);
  font-size: 19px;
  font-weight: 600;
}
.sidebar-search {
  padding: 0 16px 8px;
  flex-shrink: 0;
}
.sidebar-search :deep(.t-button) {
  overflow: hidden;
  white-space: nowrap;
}
.sidebar-collapsed .sidebar-search :deep(.t-button) {
  padding: 0;
}
.sidebar-collapsed .sidebar-search :deep(.t-button__text) {
  display: none;
}
.catalog-nav {
  flex: 1;
  min-height: 0;
}
.catalog-nav :deep(.t-default-menu__inner > .t-menu) {
  min-height: 0;
}
.catalog-empty {
  padding: 12px 16px;
  white-space: normal;
}
.footer-nav {
  flex-shrink: 0;
  border-top: 1px solid var(--td-component-stroke);
}
.sidebar :deep(.t-menu__item-link:focus-visible) {
  outline-offset: -2px;
}
.desktop-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.workspace {
  min-height: 0;
  padding: 24px 28px;
  overflow-y: auto;
  flex: 1;
}
.startup-loading {
  min-height: 240px;
  justify-content: center;
}

@media (max-width: 1050px) {
  .workspace {
    padding: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .desktop-shell,
  .sidebar :deep(.t-default-menu),
  .sidebar :deep(.t-menu__item) {
    transition: none;
  }
}
</style>
