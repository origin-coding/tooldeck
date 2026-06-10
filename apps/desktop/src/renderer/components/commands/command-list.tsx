import { Tag } from "antd";

import { EmptyState } from "@/renderer/components/common/empty-state";
import type { DesktopCommand } from "@/shared/desktop-api";

export function CommandList({
  commands,
  selectedCommandId,
  onSelect,
}: {
  commands: DesktopCommand[];
  selectedCommandId?: string;
  onSelect(command: DesktopCommand): void;
}) {
  if (commands.length === 0) {
    return <EmptyState text="No commands" />;
  }

  return (
    <div className="nav-list">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          className={classes(
            "nav-list-item",
            command.id === selectedCommandId && "nav-list-item-selected",
            !command.pluginEnabled && "nav-list-item-disabled",
          )}
          onClick={() => onSelect(command)}
        >
          <span className="nav-list-title-row">
            <span className="text-truncate nav-list-title">{command.title}</span>
            {!command.pluginEnabled ? <Tag>Disabled</Tag> : null}
          </span>
          <span className="text-truncate nav-list-meta">
            {command.id} · {command.pluginRuntimeState}
          </span>
        </button>
      ))}
    </div>
  );
}

function classes(...values: Array<string | false>): string {
  return values.filter(Boolean).join(" ");
}
