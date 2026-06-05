import { fail, failText, ok, okText, textBlock } from "@tooldeck/sdk-node";
import { describe, expect, it } from "vitest";

describe("command result helpers", () => {
  it("creates text content blocks", () => {
    expect(textBlock("hello")).toEqual({
      type: "text",
      text: "hello",
    });
  });

  it("creates success command results", () => {
    expect(ok([textBlock("hello")])).toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "hello",
        },
      ],
    });
  });

  it("creates success text command results", () => {
    expect(okText("hello")).toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "hello",
        },
      ],
    });
  });

  it("creates failed command results", () => {
    expect(fail("ERR_TEST", "Something failed", [textBlock("Details")])).toEqual({
      status: "error",
      blocks: [
        {
          type: "text",
          text: "Details",
        },
      ],
      error: {
        code: "ERR_TEST",
        message: "Something failed",
      },
    });
  });

  it("creates failed text command results", () => {
    expect(failText("ERR_TEST", "Something failed", "Details")).toEqual({
      status: "error",
      blocks: [
        {
          type: "text",
          text: "Details",
        },
      ],
      error: {
        code: "ERR_TEST",
        message: "Something failed",
      },
    });
  });

  it("omits text blocks for failed text results without text", () => {
    expect(failText("ERR_TEST", "Something failed")).toEqual({
      status: "error",
      blocks: [],
      error: {
        code: "ERR_TEST",
        message: "Something failed",
      },
    });
  });
});
