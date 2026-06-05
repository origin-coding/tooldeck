import { Loader2, Play, RefreshCw } from "lucide-react";

import type { AppView } from "@/renderer/app/types";
import { Button } from "@/renderer/components/ui/button";
import { cn } from "@/renderer/lib/utils";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function AppHeader({
  view,
  selectedCommand,
  selectedPlugin,
  isLoading,
  isRunning,
  onRefresh,
  onRun,
}: {
  view: AppView;
  selectedCommand?: DesktopCommand;
  selectedPlugin?: DesktopPlugin;
  isLoading: boolean;
  isRunning: boolean;
  onRefresh(): void;
  onRun(): void;
}) {
  const title =
    view === "commands"
      ? (selectedCommand?.title ?? (isLoading ? "Loading commands" : "No command selected"))
      : (selectedPlugin?.name ?? (isLoading ? "Loading plugins" : "No plugin selected"));
  const description =
    view === "commands"
      ? (selectedCommand?.description ?? selectedCommand?.id ?? "Select a command to run")
      : (selectedPlugin?.id ?? "Select a plugin to inspect");

  return (
    <header className="border-border flex min-h-16 items-center justify-between gap-4 border-b px-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1 truncate text-sm">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" disabled={isLoading} onClick={onRefresh}>
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          Rescan
        </Button>
        {view === "commands" ? (
          <Button
            type="button"
            disabled={!selectedCommand || !selectedCommand.pluginEnabled || isLoading || isRunning}
            onClick={onRun}
          >
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run
          </Button>
        ) : null}
      </div>
    </header>
  );
}
