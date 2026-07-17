import {
  CommandResultValidationError,
  normalizeCommandResult,
  normalizeJsonValue,
} from "@tooldeck/sdk-node";
import { describe, expect, it } from "vitest";

describe("command result validation", () => {
  it("normalizes JSON blocks into plain JSON data", () => {
    const value = Object.create(null) as Record<string, unknown>;
    value.__proto__ = { safe: true };

    const result = normalizeCommandResult({
      commandId: "test.json",
      result: {
        status: "success",
        blocks: [{ type: "json", value }],
      },
    });

    expect(result.status).toBe("success");
    const block = result.blocks[0];
    expect(block?.type).toBe("json");

    if (block?.type !== "json" || typeof block.value !== "object" || block.value === null) {
      throw new Error("Expected a JSON object block.");
    }

    expect(Object.hasOwn(block.value, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(block.value)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(block.value, "__proto__")?.value).toEqual({
      safe: true,
    });
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite JSON numbers: %s", (value) => {
    expect(() => normalizeJsonValue(value)).toThrow("Invalid JSON value");
  });

  it("rejects non-JSON object instances", () => {
    expect(() => normalizeJsonValue(new Date("2026-07-17T00:00:00.000Z"))).toThrow(
      "Invalid JSON value",
    );
  });

  it("rejects circular JSON values with the failing property path", () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    expect(() => normalizeJsonValue(value)).toThrow("--self");
  });

  it("rejects non-finite property block values", () => {
    expect(() =>
      normalizeCommandResult({
        commandId: "test.properties",
        result: {
          status: "success",
          blocks: [
            {
              type: "properties",
              items: [{ label: "Value", value: NaN }],
            },
          ],
        },
      }),
    ).toThrow(CommandResultValidationError);
  });
});
