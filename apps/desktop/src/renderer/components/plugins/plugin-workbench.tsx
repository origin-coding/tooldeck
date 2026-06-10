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
          <div className="flex items-center gap-2">
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
        <Typography.Text type="secondary">{plugin.description ?? plugin.id}</Typography.Text>
        <div className="mt-3.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <PluginMeta label="Version" value={plugin.version} />
            <PluginMeta label="Runtime" value={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <PluginMeta label="Commands" value={String(plugin.commandCount)} />
          </div>
          <Divider />
          <Typography.Text className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" type="secondary">
            {plugin.manifestPath}
          </Typography.Text>
        </div>
      </Card>

      <Card title="Contributed Commands">
        <Typography.Text type="secondary">
          Commands declared by this plugin manifest.
        </Typography.Text>
        <div className="mt-3.5">
          {commands.length === 0 ? <EmptyState text="No commands contributed" /> : null}
          {commands.length > 0 ? (
            <div className="grid gap-2">
              {commands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="grid w-full gap-1 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => onSelectCommand(command)}
                >
                  <span className="font-semibold">{command.title}</span>
                  <span className="text-xs text-gray-500">
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
    <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">{value}</span>
    </div>
  );
}
