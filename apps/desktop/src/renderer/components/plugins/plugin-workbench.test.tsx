import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import { PluginWorkbench } from "./plugin-workbench";

describe("PluginWorkbench lifecycle actions", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en-US");
  });

  it("renders uninstall for managed plugins and purge for retained data", () => {
    const html = renderToStaticMarkup(
      <PluginWorkbench
        plugin={{
          id: "dev.example.installed",
          name: "Installed Plugin",
          version: "1.0.0",
          manifestPath: "C:/plugins/dev.example.installed/manifest.json",
          sourceKind: "installed",
          enabled: true,
          runtimeState: "inactive",
          commandCount: 0,
          updatedAt: 1000,
          searchText: [],
        }}
        commands={[]}
        installState={{ status: "idle" }}
        isLoading={false}
        pluginDataResidues={[
          {
            pluginId: "dev.example.uninstalled",
            statePresent: true,
            kvEntries: 2,
          },
        ]}
        onInstall={vi.fn()}
        onPurge={vi.fn()}
        onRescan={vi.fn()}
        onSelectCommand={vi.fn()}
        onSetEnabled={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );

    expect(html).toContain("Retained plugin data");
    expect(html).toContain("dev.example.uninstalled");
    expect(html).toContain("Purge");
    expect(html).toContain("Uninstall");
  });

  it("does not render uninstall for built-in plugins", () => {
    const html = renderToStaticMarkup(
      <PluginWorkbench
        plugin={{
          id: "dev.tooldeck.builtin",
          name: "Built-in Plugin",
          version: "1.0.0",
          manifestPath: "C:/plugins/dev.tooldeck.builtin/manifest.json",
          sourceKind: "builtin",
          enabled: true,
          runtimeState: "inactive",
          commandCount: 0,
          updatedAt: 1000,
          searchText: [],
        }}
        commands={[]}
        installState={{ status: "idle" }}
        isLoading={false}
        pluginDataResidues={[]}
        onInstall={vi.fn()}
        onPurge={vi.fn()}
        onRescan={vi.fn()}
        onSelectCommand={vi.fn()}
        onSetEnabled={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );

    expect(html).not.toContain("Uninstall");
  });
});
