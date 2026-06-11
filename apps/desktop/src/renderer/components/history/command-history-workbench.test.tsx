import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import { CommandHistoryWorkbench } from "./command-history-workbench";

describe("CommandHistoryWorkbench", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en-US");
  });

  it("renders the filtered empty state", () => {
    const html = renderToStaticMarkup(
      <CommandHistoryWorkbench commandId="json.format" history={[]} isLoading={false} />,
    );

    expect(html).toContain("Command History: json.format");
    expect(html).toContain("No runs for this command");
  });

  it("renders command run rows", () => {
    const html = renderToStaticMarkup(
      <CommandHistoryWorkbench
        history={[
          {
            id: "run-1",
            commandId: "json.format",
            pluginId: "dev.tooldeck.json-tools",
            source: "desktop",
            status: "success",
            durationMs: 12,
            createdAt: 1000,
          },
        ]}
        isLoading={false}
      />,
    );

    expect(html).toContain("Command History");
    expect(html).toContain("json.format");
    expect(html).toContain("dev.tooldeck.json-tools");
    expect(html).toContain("12 ms");
  });
});
