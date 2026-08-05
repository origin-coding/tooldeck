import type { PluginHost, PluginRuntimeKind } from "@/core/plugin-host";
import {
  captureRuntimeCleanupFailure,
  createRuntimeCleanupError,
  type CapturedRuntimeCleanupFailure,
} from "@/errors/runtime-cleanup";
import { RuntimeError } from "@/errors/runtime-error";

export interface RequirePluginHostOptions {
  pluginId: string;
}

export class PluginHostRegistry<RuntimeKind extends string = PluginRuntimeKind> {
  private readonly hosts = new Map<RuntimeKind, PluginHost<RuntimeKind>>();

  register(host: PluginHost<RuntimeKind>): void {
    if (this.hosts.has(host.kind)) {
      throw new RuntimeError({
        code: "ERR_ALREADY_EXISTS",
        message: `Runtime host is already registered: ${host.kind}`,
        details: {
          runtimeKind: host.kind,
        },
      });
    }

    this.hosts.set(host.kind, host);
  }

  get(kind: RuntimeKind): PluginHost<RuntimeKind> | undefined {
    return this.hosts.get(kind);
  }

  require(kind: RuntimeKind, options: RequirePluginHostOptions): PluginHost<RuntimeKind> {
    const host = this.get(kind);

    if (!host) {
      throw new RuntimeError({
        code: "ERR_RUNTIME_HOST_UNAVAILABLE",
        message: `Runtime host is unavailable for plugin ${options.pluginId}: ${kind}`,
        details: {
          pluginId: options.pluginId,
          runtimeKind: kind,
          registeredRuntimeKinds: this.registeredRuntimeKinds(),
        },
      });
    }

    return host;
  }

  async disposeAll(): Promise<void> {
    const registeredHosts = [...this.hosts.entries()].toReversed();

    this.hosts.clear();

    const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

    for (const [runtimeKind, host] of registeredHosts) {
      try {
        await host.dispose();
      } catch (error) {
        cleanupFailures.push(
          captureRuntimeCleanupFailure({
            step: "host.dispose",
            context: { runtimeKind },
            error,
          }),
        );
      }
    }

    if (cleanupFailures.length > 0) {
      throw createRuntimeCleanupError(
        "Failed to dispose all registered plugin hosts",
        cleanupFailures,
      );
    }
  }

  private registeredRuntimeKinds(): RuntimeKind[] {
    return [...this.hosts.keys()].toSorted();
  }
}
