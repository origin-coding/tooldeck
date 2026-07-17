import { describe, expect, it, vi } from "vitest";

import {
  DesktopLifecycle,
  type DesktopBackend,
  type DesktopWindow,
} from "@/main/desktop-lifecycle";

class TestWindow implements DesktopWindow {
  private destroyed = false;
  private closedListener?: () => void;

  destroy = vi.fn(() => {
    this.destroyed = true;
    this.closedListener?.();
  });

  isDestroyed(): boolean {
    return this.destroyed;
  }

  once(_event: "closed", listener: () => void): void {
    this.closedListener = listener;
  }

  close(): void {
    this.destroyed = true;
    this.closedListener?.();
  }
}

function createHarness(options: { loadWindow?: (window: TestWindow) => Promise<void> } = {}) {
  const backend: DesktopBackend = {
    start: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  const disposeIpc = vi.fn();
  const registerIpc = vi.fn(() => disposeIpc);
  const windows: TestWindow[] = [];
  const lifecycle = new DesktopLifecycle({
    createBackend: vi.fn(() => backend),
    registerIpc,
    createWindow: vi.fn(() => {
      const window = new TestWindow();
      windows.push(window);
      return window;
    }),
    loadWindow: options.loadWindow ?? vi.fn().mockResolvedValue(undefined),
  });

  return { backend, disposeIpc, lifecycle, registerIpc, windows };
}

describe("DesktopLifecycle", () => {
  it("keeps one backend while recreating closed windows", async () => {
    const harness = createHarness();
    const firstWindow = await harness.lifecycle.openWindow();

    firstWindow.close();
    const secondWindow = await harness.lifecycle.openWindow();

    expect(secondWindow).not.toBe(firstWindow);
    expect(harness.backend.start).toHaveBeenCalledOnce();
    expect(harness.registerIpc).toHaveBeenCalledOnce();
    expect(harness.windows).toHaveLength(2);
  });

  it("coalesces concurrent backend and window startup", async () => {
    let finishLoading: (() => void) | undefined;
    const harness = createHarness({
      loadWindow: () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    });

    const first = harness.lifecycle.openWindow();
    const second = harness.lifecycle.openWindow();

    expect(harness.backend.start).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(finishLoading).toBeTypeOf("function"));
    finishLoading!();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(harness.windows).toHaveLength(1);
  });

  it("destroys a window that fails to load", async () => {
    const harness = createHarness({
      loadWindow: vi.fn().mockRejectedValue(new Error("load failed")),
    });

    await expect(harness.lifecycle.openWindow()).rejects.toThrow("load failed");

    expect(harness.windows[0]?.destroy).toHaveBeenCalledOnce();
    expect(harness.lifecycle.getWindow()).toBeUndefined();
  });

  it("shuts down IPC and the backend exactly once", async () => {
    const harness = createHarness();

    await harness.lifecycle.start();
    await Promise.all([harness.lifecycle.shutdown(), harness.lifecycle.shutdown()]);

    expect(harness.disposeIpc).toHaveBeenCalledOnce();
    expect(harness.backend.dispose).toHaveBeenCalledOnce();
  });

  it("waits for an in-flight backend start before shutting it down", async () => {
    const harness = createHarness();
    let finishStarting: (() => void) | undefined;
    vi.mocked(harness.backend.start).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishStarting = resolve;
        }),
    );

    const start = harness.lifecycle.start();
    const shutdown = harness.lifecycle.shutdown();

    await vi.waitFor(() => expect(finishStarting).toBeTypeOf("function"));
    finishStarting!();
    await Promise.all([start, shutdown]);

    expect(harness.disposeIpc).toHaveBeenCalledOnce();
    expect(harness.backend.dispose).toHaveBeenCalledOnce();
    await expect(harness.lifecycle.openWindow()).rejects.toThrow("shutting down");
  });

  it("disposes a partially started backend", async () => {
    const harness = createHarness();
    vi.mocked(harness.registerIpc).mockImplementationOnce(() => {
      throw new Error("IPC failed");
    });

    await expect(harness.lifecycle.start()).rejects.toThrow("IPC failed");

    expect(harness.backend.dispose).toHaveBeenCalledOnce();
  });
});
