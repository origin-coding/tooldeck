import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
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
    <div className="nav-list">
      {plugins.map((plugin) => (
        <button
          key={plugin.id}
          type="button"
          className={classes(
            "nav-list-item",
            plugin.id === selectedPluginId && "nav-list-item-selected",
            !plugin.enabled && "nav-list-item-disabled",
          )}
          onClick={() => onSelect(plugin)}
        >
          <span className="nav-list-title-row">
            <span className="text-truncate nav-list-title">{plugin.name}</span>
            <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
          </span>
          <span className="text-truncate nav-list-meta">
            {plugin.id} · {plugin.commandCount} commands
          </span>
        </button>
      ))}
    </div>
  );
}

function classes(...values: Array<string | false>): string {
  return values.filter(Boolean).join(" ");
}
