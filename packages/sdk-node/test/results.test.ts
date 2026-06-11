import {
  codeBlock,
  fail,
  failText,
  jsonBlock,
  ok,
  okText,
  propertiesBlock,
  textBlock,
} from "@tooldeck/sdk-node";
import { describe, expect, it } from "vitest";

describe("command result helpers", () => {
  it("creates text content blocks", () => {
    expect(textBlock("hello")).toEqual({
      type: "text",
      text: "hello",
    });
  });

  it("creates code content blocks", () => {
    expect(codeBlock('{"a":1}', "json")).toEqual({
      type: "code",
      text: '{"a":1}',
      language: "json",
    });
  });

  it("creates json content blocks", () => {
    expect(jsonBlock({ a: 1 })).toEqual({
      type: "json",
      value: {
        a: 1,
      },
    });
  });

  it("creates properties content blocks", () => {
    expect(
      propertiesBlock([
        {
          label: "Status",
          value: "valid",
          note: {
            key: "result.status.note",
            default: "Parsed successfully",
          },
        },
      ]),
    ).toEqual({
      type: "properties",
      items: [
        {
          label: "Status",
          value: "valid",
          note: {
            key: "result.status.note",
            default: "Parsed successfully",
          },
        },
      ],
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
