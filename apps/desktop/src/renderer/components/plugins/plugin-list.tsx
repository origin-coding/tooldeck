import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import { cn } from "@/renderer/lib/utils";
import type { DesktopPlugin } from "@/shared/desktop-api";

export function PluginList({
  plugins,
  selectedPluginId,
  onSelect,
}: {
  plugins: DesktopPlugin[];
  selectedPluginId?: string;
  onSelect(plugin: DesktopPlugin): void;
}) {
  if (plugins.length === 0) {
    return <EmptyState text="No plugins" />;
  }

  return (
    <div className="grid gap-1.5">
      {plugins.map((plugin) => (
        <button
          key={plugin.id}
          type="button"
          className={cn(
            "grid gap-1.5 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted",
            plugin.id === selectedPluginId && "border-border bg-background shadow-xs",
            !plugin.enabled && "opacity-65",
          )}
          onClick={() => onSelect(plugin)}
        >
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{plugin.name}</span>
            <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {plugin.id} · {plugin.commandCount} commands
          </span>
        </button>
      ))}
    </div>
  );
}
