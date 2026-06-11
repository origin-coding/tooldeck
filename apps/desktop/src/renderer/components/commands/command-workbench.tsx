import type { CommandResult } from "@tooldeck/protocol";
import { Alert, Button, Card, Typography } from "antd";
import { AlertCircle, History } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  if (!command) {
    return (
      <EmptyCard
        title={t("command.empty.title")}
        text={isLoading ? t("command.empty.loading") : t("command.empty.choose")}
      />
    );
  }

  const pluginName = plugin?.name ?? command.pluginId;
  const showRuntimeStatus =
    command.pluginEnabled &&
    command.pluginRuntimeState !== "active" &&
    command.pluginRuntimeState !== "inactive";

  return (
    <>
      <Card
        extra={
          <div className="flex items-center gap-2">
            {showRuntimeStatus ? <StatusBadge status={command.pluginRuntimeState} /> : null}
            <Button
              htmlType="button"
              icon={<History size={15} />}
              onClick={() => onOpenHistory(command.id)}
            >
              {t("command.history")}
            </Button>
          </div>
        }
        title={command.title}
      >
        <Typography.Text type="secondary">{command.description ?? command.id}</Typography.Text>
        <Typography.Text className="mt-2 block" type="secondary">
          {t("command.sourceLine", {
            commandId: command.id,
            pluginName,
          })}
        </Typography.Text>
        {!command.pluginEnabled ? (
          <Alert
            showIcon
            className="mt-3.5"
            description={t("command.pluginDisabled.description", {
              pluginName,
            })}
            icon={<AlertCircle size={16} />}
            title={t("command.pluginDisabled.title")}
            type="warning"
          />
        ) : null}
      </Card>

      <div className="grid min-h-96 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("command.input")}>
          <CommandInputForm command={command} input={input} onChange={onChangeInput} />
        </Card>

        <Card extra={<StatusBadge status={result?.status ?? "idle"} />} title={t("command.output")}>
          {runError ? (
            <ErrorNotice message={runError} title={t("command.runFailed")} compact />
          ) : null}
          <CommandOutput result={result} hasError={Boolean(runError)} />
        </Card>
      </div>
    </>
  );
}
