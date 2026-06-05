import { EmptyState } from "@/renderer/components/common/empty-state";
import { Badge } from "@/renderer/components/ui/badge";
import { cn } from "@/renderer/lib/utils";
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
    <div className="grid gap-1.5">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          className={cn(
            "grid min-h-16 gap-1 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted",
            command.id === selectedCommandId && "border-border bg-background shadow-xs",
            !command.pluginEnabled && "opacity-55",
          )}
          onClick={() => onSelect(command)}
        >
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{command.title}</span>
            {!command.pluginEnabled ? <Badge variant="outline">Disabled</Badge> : null}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {command.id} · {command.pluginRuntimeState}
          </span>
        </button>
      ))}
    </div>
  );
}
