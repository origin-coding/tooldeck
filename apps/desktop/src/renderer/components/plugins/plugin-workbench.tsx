import { Power } from "lucide-react";

import { EmptyCard } from "@/renderer/components/common/empty-card";
import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import { Button } from "@/renderer/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/renderer/components/ui/card";
import { Separator } from "@/renderer/components/ui/separator";
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
      <Card>
        <CardHeader>
          <CardTitle>{plugin.name}</CardTitle>
          <CardDescription>{plugin.id}</CardDescription>
          <CardAction className="flex items-center gap-2">
            <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <Button
              type="button"
              variant={plugin.enabled ? "secondary" : "outline"}
              disabled={isLoading}
              onClick={() => onSetEnabled(plugin.id, !plugin.enabled)}
            >
              <Power className="size-4" />
              {plugin.enabled ? "Disable" : "Enable"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <PluginMeta label="Version" value={plugin.version} />
            <PluginMeta label="Runtime" value={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <PluginMeta label="Commands" value={String(plugin.commandCount)} />
          </div>
          <Separator className="my-4" />
          <div className="text-muted-foreground truncate text-xs">{plugin.manifestPath}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contributed Commands</CardTitle>
          <CardDescription>Commands declared by this plugin manifest.</CardDescription>
        </CardHeader>
        <CardContent>
          {commands.length === 0 ? (
            <EmptyState text="No commands contributed" />
          ) : (
            <div className="grid gap-2">
              {commands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="border-border bg-background hover:bg-muted grid gap-1 rounded-md border px-3 py-2.5 text-left transition-colors"
                  onClick={() => onSelectCommand(command)}
                >
                  <span className="font-medium">{command.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {command.description ?? command.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PluginMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/30 grid gap-1 rounded-md border px-3 py-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
