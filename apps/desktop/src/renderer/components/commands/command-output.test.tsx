import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommandOutput } from "./command-output";

describe("CommandOutput", () => {
  it("renders text, code, and json content blocks", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "success",
          blocks: [
            {
              type: "text",
              text: "plain output",
            },
            {
              type: "code",
              text: "const value = 1;",
              language: "ts",
            },
            {
              type: "json",
              value: {
                a: 1,
              },
            },
          ],
        }}
      />,
    );

    expect(html).toContain("plain output");
    expect(html).toContain("const value = 1;");
    expect(html).toContain("&quot;a&quot;: 1");
  });
});
