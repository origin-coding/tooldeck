import { Button, Card, Divider, Typography } from "antd";
import { Power } from "lucide-react";

import { EmptyCard } from "@/renderer/components/common/empty-card";
import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function PluginWorkbench({
  plugin,
  commands,
  isLoading,
  onSelectCommand,
  onSetEnabled,
}: {
  plugin?: DesktopPlugin;
  commands: DesktopCommand[];
  isLoading: boolean;
  onSelectCommand(command: DesktopCommand): void;
  onSetEnabled(pluginId: string, enabled: boolean): void;
}) {
  if (!plugin) {
    return (
      <EmptyCard
        title="No plugin selected"
        text={isLoading ? "Loading plugins" : "Choose a plugin from the list."}
      />
    );
  }

  return (
    <>
      <Card
        extra={
          <div className="card-extra">
            <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <Button
              disabled={isLoading}
              htmlType="button"
              icon={<Power size={15} />}
              onClick={() => onSetEnabled(plugin.id, !plugin.enabled)}
              type={plugin.enabled ? "default" : "primary"}
            >
              {plugin.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        }
        title={plugin.name}
      >
        <Typography.Text type="secondary">{plugin.id}</Typography.Text>
        <div className="section-offset">
          <div className="metrics-grid">
            <PluginMeta label="Version" value={plugin.version} />
            <PluginMeta label="Runtime" value={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <PluginMeta label="Commands" value={String(plugin.commandCount)} />
          </div>
          <Divider />
          <Typography.Text className="text-truncate block" type="secondary">
            {plugin.manifestPath}
          </Typography.Text>
        </div>
      </Card>

      <Card title="Contributed Commands">
        <Typography.Text type="secondary">
          Commands declared by this plugin manifest.
        </Typography.Text>
        <div className="section-offset">
          {commands.length === 0 ? <EmptyState text="No commands contributed" /> : null}
          {commands.length > 0 ? (
            <div className="command-card-list">
              {commands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="command-card-list-item"
                  onClick={() => onSelectCommand(command)}
                >
                  <span className="command-card-list-title">{command.title}</span>
                  <span className="command-card-list-meta">
                    {command.description ?? command.id}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </>
  );
}

function PluginMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-box">
      <span className="metric-label">{label}</span>
      <span className="text-truncate metric-value">{value}</span>
    </div>
  );
}
