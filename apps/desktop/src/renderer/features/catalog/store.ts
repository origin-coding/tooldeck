import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import type { DesktopCommand, DesktopPlugin } from "@/shared/api";

export interface CatalogSnapshot {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
}

export const useCatalogStore = defineStore("catalog", () => {
  // Recursive JSON/schema snapshots must be replaced, not deeply unwrapped.
  const commands = shallowRef<DesktopCommand[]>([]);
  const plugins = ref<DesktopPlugin[]>([]);
  let revision = 0;

  function replace(next: CatalogSnapshot) {
    ++revision;
    commands.value = next.commands;
    plugins.value = next.plugins;
  }

  async function refresh(locale: string): Promise<CatalogSnapshot | undefined> {
    const request = ++revision;
    const [commands, plugins] = await Promise.all([
      window.tooldeck.commands.list({ locale }),
      window.tooldeck.plugins.list({ locale }),
    ]);
    if (request !== revision) return;
    const next = { commands, plugins };
    replace(next);
    return next;
  }

  return { commands, plugins, replace, refresh };
});
