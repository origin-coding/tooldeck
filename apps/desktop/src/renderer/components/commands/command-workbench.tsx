import type { CommandResult } from "@tooldeck/protocol";
import { Alert, Button, Card, Tag, Typography } from "antd";
import { AlertCircle, History } from "lucide-react";

import { CommandInputForm } from "@/renderer/components/commands/command-input-form";
import { CommandOutput } from "@/renderer/components/commands/command-output";
import { EmptyCard } from "@/renderer/components/common/empty-card";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function CommandWorkbench({
  command,
  plugin,
  input,
  isLoading,
  result,
  runError,
  onChangeInput,
  onOpenHistory,
}: {
  command?: DesktopCommand;
  plugin?: DesktopPlugin;
  input: Record<string, string>;
  isLoading: boolean;
  result?: CommandResult;
  runError?: string;
  onChangeInput(key: string, value: string): void;
  onOpenHistory(commandId: string): void;
}) {
  if (!command) {
    return (
      <EmptyCard
        title="No command selected"
        text={isLoading ? "Loading commands" : "Choose a command from the list."}
      />
    );
  }

  return (
    <>
      <Card
        extra={
          <div className="flex items-center gap-2">
            <StatusBadge status={command.pluginEnabled ? command.pluginRuntimeState : "disabled"} />
            {plugin ? <Tag>{plugin.name}</Tag> : null}
            <Button
              htmlType="button"
              icon={<History size={15} />}
              onClick={() => onOpenHistory(command.id)}
            >
              History
            </Button>
          </div>
        }
        title={command.title}
      >
        <Typography.Text type="secondary">{command.description ?? command.id}</Typography.Text>
        {!command.pluginEnabled ? (
          <Alert
            showIcon
            className="mt-3.5"
            description={`Enable ${plugin?.name ?? command.pluginId} before running this command.`}
            icon={<AlertCircle size={16} />}
            title="Plugin disabled"
            type="warning"
          />
        ) : null}
      </Card>

      <div className="grid min-h-96 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Input">
          <Typography.Text type="secondary">{command.id}</Typography.Text>
          <div className="mt-3.5">
            <CommandInputForm command={command} input={input} onChange={onChangeInput} />
          </div>
        </Card>

        <Card extra={<StatusBadge status={result?.status ?? "idle"} />} title="Output">
          {runError ? <ErrorNotice message={runError} title="Run failed" compact /> : null}
          <CommandOutput result={result} hasError={Boolean(runError)} />
        </Card>
      </div>
    </>
  );
}
