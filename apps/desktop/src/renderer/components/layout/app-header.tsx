import { Button, Typography } from "antd";
import { Play, RefreshCw } from "lucide-react";

import type { AppView } from "@/renderer/app/types";
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
    view === "settings"
      ? "Settings"
      : view === "commands"
      ? (selectedCommand?.title ?? (isLoading ? "Loading commands" : "No command selected"))
      : (selectedPlugin?.name ?? (isLoading ? "Loading plugins" : "No plugin selected"));
  const description =
    view === "settings"
      ? "Local desktop preferences and workspace state"
      : view === "commands"
      ? (selectedCommand?.description ?? selectedCommand?.id ?? "Select a command to run")
      : (selectedPlugin?.id ?? "Select a plugin to inspect");

  return (
    <header className="app-header">
      <div className="app-header-title-block">
        <Typography.Title className="app-header-title" level={4}>
          {title}
        </Typography.Title>
        <Typography.Text className="text-truncate block" type="secondary">
          {description}
        </Typography.Text>
      </div>
      <div className="app-header-actions">
        <Button
          disabled={isLoading}
          htmlType="button"
          icon={<RefreshCw className={isLoading ? "spin-icon" : undefined} size={15} />}
          onClick={onRefresh}
        >
          Rescan
        </Button>
        {view === "commands" ? (
          <Button
            disabled={!selectedCommand || !selectedCommand.pluginEnabled || isLoading || isRunning}
            htmlType="button"
            icon={<Play size={15} />}
            loading={isRunning}
            onClick={onRun}
            type="primary"
          >
            Run
          </Button>
        ) : null}
      </div>
    </header>
  );
}
