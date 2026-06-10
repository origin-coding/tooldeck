import type { CommandResult } from "@tooldeck/protocol";
import { Alert, Card, Tag, Typography } from "antd";
import { AlertCircle, History } from "lucide-react";

import { CommandHistory } from "@/renderer/components/commands/command-history";
import { CommandInputForm } from "@/renderer/components/commands/command-input-form";
import { CommandOutput } from "@/renderer/components/commands/command-output";
import { EmptyCard } from "@/renderer/components/common/empty-card";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { CommandRunRecord, DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function CommandWorkbench({
  command,
  plugin,
  history,
  input,
  isLoading,
  result,
  runError,
  onChangeInput,
}: {
  command?: DesktopCommand;
  plugin?: DesktopPlugin;
  history: CommandRunRecord[];
  input: Record<string, string>;
  isLoading: boolean;
  result?: CommandResult;
  runError?: string;
  onChangeInput(key: string, value: string): void;
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
          <div className="card-extra">
            <StatusBadge status={command.pluginEnabled ? command.pluginRuntimeState : "disabled"} />
            {plugin ? <Tag>{plugin.name}</Tag> : null}
          </div>
        }
        title={command.title}
      >
        <Typography.Text type="secondary">{command.description ?? command.id}</Typography.Text>
        {!command.pluginEnabled ? (
          <Alert
            showIcon
            className="section-offset"
            description={`Enable ${plugin?.name ?? command.pluginId} before running this command.`}
            icon={<AlertCircle size={16} />}
            title="Plugin disabled"
            type="warning"
          />
        ) : null}
      </Card>

      <div className="workbench-grid">
        <Card title="Input">
          <Typography.Text type="secondary">{command.id}</Typography.Text>
          <div className="section-offset">
            <CommandInputForm command={command} input={input} onChange={onChangeInput} />
          </div>
        </Card>

        <Card extra={<StatusBadge status={result?.status ?? "idle"} />} title="Output">
          {runError ? <ErrorNotice message={runError} title="Run failed" compact /> : null}
          <CommandOutput result={result} hasError={Boolean(runError)} />
        </Card>
      </div>

      <Card
        title={
          <span className="title-with-icon">
            <History size={16} />
            Command History
          </span>
        }
      >
        <Typography.Text type="secondary">{history.length} recent runs</Typography.Text>
        <div className="section-offset">
          <CommandHistory history={history} isLoading={isLoading} />
        </div>
      </Card>
    </>
  );
}
