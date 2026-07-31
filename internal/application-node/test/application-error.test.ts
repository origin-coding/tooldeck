import { RuntimeError } from "@tooldeck/runtime-node";
import { describe, expect, it } from "vitest";

import {
  ApplicationError,
  fromRuntimeError,
  isApplicationError,
  toApplicationError,
  toApplicationErrorTransport,
} from "@/index";

describe("ApplicationError", () => {
  it("preserves its source, code, details, and cause", () => {
    const cause = new Error("database failure");
    const error = new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application startup failed",
      cause,
      details: {
        operation: "start",
      },
    });

    expect(error).toMatchObject({
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application startup failed",
      cause,
      details: {
        operation: "start",
      },
    });
  });

  it("recognizes an application error by stable shape and optional code", () => {
    const foreignApplicationError = {
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid configuration",
      details: {
        field: "databasePath",
      },
    };

    expect(foreignApplicationError).not.toBeInstanceOf(ApplicationError);
    expect(isApplicationError(foreignApplicationError)).toBe(true);
    expect(isApplicationError(foreignApplicationError, "ERR_INVALID_ARGUMENT")).toBe(true);
    expect(isApplicationError(foreignApplicationError, "ERR_NOT_FOUND")).toBe(false);
    expect(toApplicationError(foreignApplicationError)).toBe(foreignApplicationError);
  });

  it("converts runtime errors without exposing their type through the function signature", () => {
    const runtimeError = new RuntimeError({
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      message: "No runtime host is registered",
      details: {
        pluginId: "dev.example.plugin",
        runtimeKind: "node",
      },
    });
    const applicationError = fromRuntimeError(runtimeError);

    expect(applicationError).toMatchObject({
      _tag: "ApplicationError",
      source: "runtime",
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      message: "No runtime host is registered",
      cause: runtimeError,
      details: {
        pluginId: "dev.example.plugin",
        runtimeKind: "node",
      },
    });
  });

  it("normalizes regular and non-Error application failures", () => {
    const cause = new Error("unexpected failure");

    expect(toApplicationError(cause)).toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "unexpected failure",
      cause,
    });
    expect(toApplicationError("string failure")).toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "string failure",
      details: {
        thrown: "string failure",
      },
    });
  });

  it("serializes only stable JSON-safe transport fields", () => {
    const cause = new Error("internal failure");
    const error = new ApplicationError({
      source: "application",
      code: "ERR_COMMAND_FAILED",
      message: "Command execution failed",
      cause,
      details: {
        commandId: "json.format",
      },
    });

    expect(toApplicationErrorTransport(error)).toEqual({
      tag: "ApplicationError",
      source: "application",
      code: "ERR_COMMAND_FAILED",
      message: "Command execution failed",
      details: {
        commandId: "json.format",
      },
    });
  });
});
