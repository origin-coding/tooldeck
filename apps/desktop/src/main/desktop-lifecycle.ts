export interface DesktopBackend {
  start(): Promise<void>;
  dispose(): Promise<void>;
}

export interface DesktopWindow {
  destroy(): void;
  isDestroyed(): boolean;
  once(event: "closed", listener: () => void): unknown;
}

export interface DesktopLifecycleOptions<
  TBackend extends DesktopBackend,
  TWindow extends DesktopWindow,
> {
  createBackend(): TBackend;
  registerIpc(backend: TBackend): () => void;
  createWindow(): TWindow;
  loadWindow(window: TWindow): Promise<void>;
}

export class DesktopLifecycle<TBackend extends DesktopBackend, TWindow extends DesktopWindow> {
  private backend?: TBackend;
  private disposeIpc?: () => void;
  private window?: TWindow;
  private startPromise?: Promise<void>;
  private openWindowPromise?: Promise<TWindow>;
  private shutdownPromise?: Promise<void>;

  constructor(private readonly options: DesktopLifecycleOptions<TBackend, TWindow>) {}

  getWindow(): TWindow | undefined {
    return this.window?.isDestroyed() ? undefined : this.window;
  }

  start(): Promise<void> {
    if (this.shutdownPromise) {
      return Promise.reject(new Error("Desktop lifecycle is shutting down."));
    }

    if (!this.startPromise) {
      const startPromise = this.startBackend();
      this.startPromise = startPromise;

      void startPromise.catch(() => {
        if (this.startPromise === startPromise) {
          this.startPromise = undefined;
        }
      });
    }

    return this.startPromise;
  }

  async openWindow(): Promise<TWindow> {
    if (this.shutdownPromise) {
      throw new Error("Desktop lifecycle is shutting down.");
    }

    const currentWindow = this.getWindow();

    if (currentWindow) {
      return currentWindow;
    }

    if (!this.openWindowPromise) {
      const openWindowPromise = this.createAndLoadWindow();
      this.openWindowPromise = openWindowPromise;

      const clearOpenWindowPromise = () => {
        if (this.openWindowPromise === openWindowPromise) {
          this.openWindowPromise = undefined;
        }
      };

      void openWindowPromise.then(clearOpenWindowPromise, clearOpenWindowPromise);
    }

    return this.openWindowPromise;
  }

  shutdown(): Promise<void> {
    this.shutdownPromise ??= this.shutdownBackend();
    return this.shutdownPromise;
  }

  private async startBackend(): Promise<void> {
    const backend = this.options.createBackend();
    let disposeIpc: (() => void) | undefined;

    try {
      await backend.start();
      disposeIpc = this.options.registerIpc(backend);
    } catch (error) {
      const cleanupErrors: unknown[] = [];

      try {
        disposeIpc?.();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }

      try {
        await backend.dispose();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          "Desktop backend startup failed and cleanup did not complete.",
          { cause: error },
        );
      }

      throw error;
    }

    this.backend = backend;
    this.disposeIpc = disposeIpc;
  }

  private async createAndLoadWindow(): Promise<TWindow> {
    await this.start();

    if (this.shutdownPromise) {
      throw new Error("Desktop lifecycle is shutting down.");
    }

    const window = this.options.createWindow();
    this.window = window;
    window.once("closed", () => {
      if (this.window === window) {
        this.window = undefined;
      }
    });

    try {
      await this.options.loadWindow(window);
      return window;
    } catch (error) {
      if (this.window === window) {
        this.window = undefined;
      }

      if (!window.isDestroyed()) {
        window.destroy();
      }

      throw error;
    }
  }

  private async shutdownBackend(): Promise<void> {
    const errors: unknown[] = [];

    try {
      await this.startPromise;
    } catch {
      // startBackend cleans up its partial backend before rejecting.
    }

    const disposeIpc = this.disposeIpc;
    const backend = this.backend;

    this.disposeIpc = undefined;
    this.backend = undefined;
    this.startPromise = undefined;

    try {
      disposeIpc?.();
    } catch (error) {
      errors.push(error);
    }

    try {
      await backend?.dispose();
    } catch (error) {
      errors.push(error);
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Desktop backend shutdown did not complete.");
    }
  }
}
