import { describe, expect, it, vi } from "vitest";

import { focusExistingWindow } from "@/main/single-instance";

function createWindowMock(options: { minimized?: boolean } = {}) {
  return {
    focus: vi.fn(),
    isMinimized: vi.fn(() => options.minimized ?? false),
    restore: vi.fn(),
    show: vi.fn(),
  };
}

describe("desktop single instance handling", () => {
  it("does nothing when there is no existing window", () => {
    expect(() => focusExistingWindow(undefined)).not.toThrow();
  });

  it("shows and focuses the existing window", () => {
    const window = createWindowMock();

    focusExistingWindow(window);

    expect(window.restore).not.toHaveBeenCalled();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it("restores the existing window before focusing when minimized", () => {
    const window = createWindowMock({ minimized: true });

    focusExistingWindow(window);

    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });
});
