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
const heading = computed(() =>
  route.path.startsWith("/settings")
    ? t("common.settings")
    : route.path.startsWith("/history")
      ? t("history.title")
      : route.path.startsWith("/commands")
        ? t("common.commands")
        : t("common.plugins"),
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
      <NuxtLink to="/" class="brand" aria-label="Tooldeck"
        ><span class="brand-mark">T</span
        ><strong v-if="!workspace.collapsed">Tooldeck</strong></NuxtLink
      >
      <t-button
        block
        variant="outline"
        :aria-label="t('navigation.search')"
        @click="searchOpen = true"
      >
        <template #icon><search-icon /></template
        ><span v-if="!workspace.collapsed">{{ t("navigation.search") }}</span>
      </t-button>
      <nav
        class="catalog-nav"
        :aria-label="
          workspace.navigationMode === 'provider-first' ? t('common.plugins') : t('common.commands')
        "
      >
        <NuxtLink
          v-for="entry in entries"
          :key="entry.id"
          :to="entry.path"
          :title="entry.title"
          class="nav-link"
        >
          <extension-icon v-if="workspace.navigationMode === 'provider-first'" /><tools-icon
            v-else
          />
          <span v-if="!workspace.collapsed">{{ entry.title }}</span>
        </NuxtLink>
        <p v-if="entries.length === 0 && !workspace.collapsed" class="muted">
          {{
            t(
              workspace.navigationMode === "provider-first"
                ? "navigation.noPluginsFound"
                : "navigation.noCommandsFound",
            )
          }}
        </p>
      </nav>
      <nav class="footer-nav">
        <NuxtLink to="/plugins" class="nav-link" :title="t('common.plugins')"
          ><extension-icon /><span v-if="!workspace.collapsed">{{
            t("common.plugins")
          }}</span></NuxtLink
        >
        <NuxtLink to="/history" class="nav-link" :title="t('history.title')"
          ><history-icon /><span v-if="!workspace.collapsed">{{
            t("history.title")
          }}</span></NuxtLink
        >
        <NuxtLink to="/settings" class="nav-link" :title="t('common.settings')"
          ><setting-icon /><span v-if="!workspace.collapsed">{{
            t("common.settings")
          }}</span></NuxtLink
        >
        <t-button
          variant="text"
          :disabled="workspace.blocked"
          :aria-label="t('settings.sidebarCollapsed.label')"
          @click="workspace.setPreference('desktop', 'sidebar.collapsed', !workspace.collapsed)"
        >
          <template #icon
            ><menu-fold-icon v-if="!workspace.collapsed" /><menu-unfold-icon v-else
          /></template>
        </t-button>
      </nav>
    </aside>
    <div class="desktop-main">
      <header class="topbar">
        <h1>{{ heading }}</h1>
        <t-tag variant="light">Tooldeck</t-tag>
      </header>
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
