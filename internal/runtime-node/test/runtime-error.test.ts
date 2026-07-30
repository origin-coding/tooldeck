import { describe, expect, it } from "vitest";

import { isRuntimeError, RuntimeError, toRuntimeError } from "../src";

describe("RuntimeError", () => {
  it("preserves its code, details, and cause", () => {
    const cause = new Error("source failure");
    const error = new RuntimeError({
      code: "ERR_COMMAND_FAILED",
      message: "Command failed",
      cause,
      details: {
        commandId: "json.format",
      },
    });

    expect(error).toMatchObject({
      _tag: "RuntimeError",
      name: "RuntimeError",
      code: "ERR_COMMAND_FAILED",
      message: "Command failed",
      details: {
        commandId: "json.format",
      },
      cause,
    });
  });

  it("recognizes a runtime error by stable shape instead of class identity", () => {
    const foreignRuntimeError = {
      _tag: "RuntimeError",
      name: "RuntimeError",
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid input",
      details: {
        field: "text",
      },
    };

    expect(foreignRuntimeError).not.toBeInstanceOf(RuntimeError);
    expect(isRuntimeError(foreignRuntimeError)).toBe(true);
    expect(toRuntimeError(foreignRuntimeError)).toBe(foreignRuntimeError);
  });

  it("normalizes a regular Error and preserves it as the cause", () => {
    const cause = new Error("unexpected failure");
    const error = toRuntimeError(cause);

    expect(error).toMatchObject({
      _tag: "RuntimeError",
      code: "ERR_UNKNOWN",
      message: "unexpected failure",
      cause,
    });
  });

  it("normalizes a non-Error thrown value with JSON-safe details", () => {
    expect(toRuntimeError("string failure")).toMatchObject({
      _tag: "RuntimeError",
      code: "ERR_UNKNOWN",
      message: "string failure",
      details: {
        thrown: "string failure",
      },
    });
  });
});
