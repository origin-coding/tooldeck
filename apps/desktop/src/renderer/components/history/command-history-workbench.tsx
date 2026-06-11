import { Card, Descriptions, Drawer, List, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CommandRunRecord } from "@/shared/desktop-api";

import { EmptyState } from "../common/empty-state";
import { StatusBadge } from "../common/status-badge";

export function CommandHistoryWorkbench({
  commandId,
  history,
  isLoading,
}: {
  commandId?: string;
  history: CommandRunRecord[];
  isLoading: boolean;
}) {
  const { i18n, t } = useTranslation();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const selectedRun = useMemo(
    () => history.find((run) => run.id === selectedRunId),
    [history, selectedRunId],
  );

  return (
    <>
      <Card title={commandId ? t("history.titleFor", { commandId }) : t("history.title")}>
        {history.length === 0 ? (
          <EmptyState
            text={
              isLoading
                ? t("history.loading")
                : commandId
                  ? t("history.emptyForCommand")
                  : t("history.empty")
            }
          />
        ) : (
          <List
            bordered
            dataSource={history}
            renderItem={(run) => (
              <List.Item
                actions={[
                  <StatusBadge key="status" status={run.status} />,
                  <Typography.Text key="duration" type="secondary">
                    {run.durationMs ?? 0} ms
                  </Typography.Text>,
                ]}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => setSelectedRunId(run.id)}
              >
                <List.Item.Meta
                  description={`${run.pluginId ?? t("history.unknownPlugin")} · ${
                    run.source
                  } · ${new Date(run.createdAt).toLocaleString(i18n.resolvedLanguage)}`}
                  title={run.commandId}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Drawer
        open={Boolean(selectedRun)}
        title={t("history.detailsTitle")}
        size={640}
        onClose={() => setSelectedRunId(undefined)}
      >
        {selectedRun ? <RunDetails run={selectedRun} /> : null}
      </Drawer>
    </>
  );
}

function RunDetails({ run }: { run: CommandRunRecord }) {
  const { i18n, t } = useTranslation();

  return (
    <div className="grid gap-4">
      <Descriptions
        bordered
        column={1}
        size="small"
        items={[
          { key: "id", label: t("history.runId"), children: run.id },
          { key: "commandId", label: t("history.commandId"), children: run.commandId },
          {
            key: "pluginId",
            label: t("history.pluginId"),
            children: run.pluginId ?? t("common.unknown"),
          },
          { key: "source", label: t("history.source"), children: run.source },
          {
            key: "status",
            label: t("history.status"),
            children: <StatusBadge status={run.status} />,
          },
          {
            key: "durationMs",
            label: t("history.duration"),
            children: `${run.durationMs ?? 0} ms`,
          },
          {
            key: "createdAt",
            label: t("history.createdAt"),
            children: new Date(run.createdAt).toLocaleString(i18n.resolvedLanguage),
          },
        ]}
      />
      <JsonPanel
        title={t("history.inputJson")}
        value={run.input}
        undefinedText={t("common.undefined")}
      />
      <JsonPanel
        title={t("history.output")}
        value={run.output}
        undefinedText={t("common.undefined")}
      />
      <JsonPanel
        title={t("history.error")}
        value={run.error}
        undefinedText={t("common.undefined")}
      />
    </div>
  );
}

function JsonPanel({
  title,
  value,
  undefinedText,
}: {
  title: string;
  value: unknown;
  undefinedText: string;
}) {
  return (
    <div className="grid gap-2">
      <Typography.Text strong>{title}</Typography.Text>
      <pre className="m-0 max-h-70 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed">
        {formatJson(value, undefinedText)}
      </pre>
    </div>
  );
}

function formatJson(value: unknown, undefinedText: string): string {
  if (value === undefined) {
    return undefinedText;
  }

  return JSON.stringify(value, null, 2);
}
