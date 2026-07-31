import type { JsonObject } from "@tooldeck/protocol";

import type { PluginHost, PluginRuntimeKind } from "@/core/plugin-host";
import { RuntimeError, toRuntimeError } from "@/errors/runtime-error";

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

    const errors: JsonObject[] = [];
    const causes: unknown[] = [];

    for (const [runtimeKind, host] of registeredHosts) {
      try {
        await host.dispose();
      } catch (error) {
        const runtimeError = toRuntimeError(error);

        causes.push(error);
        errors.push({
          runtimeKind,
          code: runtimeError.code,
          message: runtimeError.message,
        });
      }
    }

    if (errors.length > 0) {
      const message = "Failed to dispose all registered plugin hosts";

      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message,
        cause: new AggregateError(causes, message),
        details: {
          errors,
        },
      });
    }
  }

  private registeredRuntimeKinds(): RuntimeKind[] {
    return [...this.hosts.keys()].toSorted();
  }
}
