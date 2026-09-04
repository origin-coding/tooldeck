import { onMounted, watch } from "vue";

import { usePreferencesStore } from "@/renderer/features/preferences/store";
import { writeDesktopSession } from "@/renderer/utils/session";

import { useWorkspaceActions } from "./workspace";

export function useDesktopBootstrap() {
  const workspace = useWorkspaceActions();
  const preferences = usePreferencesStore();
  const route = useRoute();
  const { locale, setLocale } = useI18n();
  useHead(() => ({ htmlAttrs: { lang: locale.value } }));
  watch(
    () => preferences.locale,
    (value) => void setLocale(value),
    { immediate: true },
  );
  watch(
    () => route.fullPath,
    (path) => {
      if (path !== "/" && workspace.initialized) writeDesktopSession({ path });
    },
  );
  onMounted(() => void workspace.initialize());
  return { locale };
}
