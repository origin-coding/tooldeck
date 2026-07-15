import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import { PluginPackageDropZone } from "./plugin-package-drop-zone";

describe("PluginPackageDropZone", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en-US");
  });

  it("renders a drag-only installation surface", () => {
    const html = renderToStaticMarkup(
      <PluginPackageDropZone
        installState={{ status: "idle" }}
        isLoading={false}
        onInstall={vi.fn()}
        onRescan={vi.fn()}
      />,
    );

    expect(html).toContain("Drop one .tdplugin package here");
    expect(html).toContain("Clicking does not open a file picker");
    expect(html).not.toContain("<input");
  });

  it("renders the committed install refresh warning and rescan action", () => {
    const html = renderToStaticMarkup(
      <PluginPackageDropZone
        installState={{
          status: "refresh-failed",
          pluginId: "dev.example.installed",
          packageName: "installed.tdplugin",
          message: "forced refresh failure",
        }}
        isLoading={false}
        onInstall={vi.fn()}
        onRescan={vi.fn()}
      />,
    );

    expect(html).toContain("Plugin installed, but the runtime refresh failed");
    expect(html).toContain("forced refresh failure");
    expect(html).toContain("Rescan");
  });
});
