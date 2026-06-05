import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommandOutput } from "./command-output";

describe("CommandOutput", () => {
  it("renders text content blocks", () => {
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
          ],
        }}
      />,
    );

    expect(html).toContain("text");
    expect(html).toContain("plain output");
  });

  it("renders code content blocks with the language label", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "success",
          blocks: [
            {
              type: "code",
              text: "const value = 1;",
              language: "ts",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("ts");
    expect(html).toContain("const value = 1;");
  });

  it("pretty prints json content blocks", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "success",
          blocks: [
            {
              type: "json",
              value: {
                a: 1,
                nested: {
                  ok: true,
                },
              },
            },
          ],
        }}
      />,
    );

    expect(html).toContain("json");
    expect(html).toContain("&quot;a&quot;: 1");
    expect(html).toContain("&quot;nested&quot;: {");
    expect(html).toContain("&quot;ok&quot;: true");
  });

  it("renders an explicit empty output state", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "success",
          blocks: [],
        }}
      />,
    );

    expect(html).toContain("Empty output");
    expect(html).toContain("The command completed without output.");
  });

  it("renders an explicit error state for failed results", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "error",
          error: {
            message: "Invalid JSON",
            code: "JSON_PARSE_ERROR",
          },
          blocks: [
            {
              type: "text",
              text: "Unexpected token",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Invalid JSON");
    expect(html).toContain("Unexpected token");
    expect(html).toContain("border-destructive");
  });

  it("renders an idle failed state when no command result is available", () => {
    const html = renderToStaticMarkup(<CommandOutput hasError result={undefined} />);

    expect(html).toContain("Command failed");
    expect(html).toContain("The command did not return output.");
  });

  it("keeps long output scrollable", () => {
    const html = renderToStaticMarkup(
      <CommandOutput
        hasError={false}
        result={{
          status: "success",
          blocks: [
            {
              type: "code",
              text: "line\n".repeat(200),
              language: "json",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("max-h-[32rem]");
    expect(html).toContain("max-h-96");
    expect(html).toContain("overflow-auto");
  });
});
