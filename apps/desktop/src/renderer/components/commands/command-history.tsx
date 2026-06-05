import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { CommandRunRecord } from "@/shared/desktop-api";

export function CommandHistory({
  history,
  isLoading,
}: {
  history: CommandRunRecord[];
  isLoading: boolean;
}) {
  if (history.length === 0) {
    return <EmptyState text={isLoading ? "Loading history" : "No command runs"} />;
  }

  return (
    <div className="divide-border border-border divide-y rounded-md border">
      {history.map((run) => (
        <div
          key={run.id}
          className="grid grid-cols-[minmax(0,1fr)_84px_86px] items-center gap-3 px-4 py-3 max-md:grid-cols-1"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{run.commandId}</div>
            <div className="text-muted-foreground truncate text-xs">
              {new Date(run.createdAt).toLocaleString()} · {run.source}
            </div>
          </div>
          <StatusBadge status={run.status} />
          <span className="text-muted-foreground text-right text-xs max-md:text-left">
            {run.durationMs ?? 0} ms
          </span>
        </div>
      ))}
    </div>
  );
}
