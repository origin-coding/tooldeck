import { Card, Descriptions, Drawer, List, Typography } from "antd";
import { useMemo, useState } from "react";

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
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const selectedRun = useMemo(
    () => history.find((run) => run.id === selectedRunId),
    [history, selectedRunId],
  );

  return (
    <>
      <Card title={commandId ? `Command History: ${commandId}` : "Command History"}>
        {history.length === 0 ? (
          <EmptyState text={isLoading ? "Loading history" : commandId ? "No runs for this command" : "No command runs"} />
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
                  description={`${run.pluginId ?? "unknown plugin"} · ${run.source} · ${new Date(
                    run.createdAt,
                  ).toLocaleString()}`}
                  title={run.commandId}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Drawer
        open={Boolean(selectedRun)}
        title="Command Run Details"
        size={640}
        onClose={() => setSelectedRunId(undefined)}
      >
        {selectedRun ? <RunDetails run={selectedRun} /> : null}
      </Drawer>
    </>
  );
}

function RunDetails({ run }: { run: CommandRunRecord }) {
  return (
    <div className="grid gap-4">
      <Descriptions
        bordered
        column={1}
        size="small"
        items={[
          { key: "id", label: "Run ID", children: run.id },
          { key: "commandId", label: "Command ID", children: run.commandId },
          { key: "pluginId", label: "Plugin ID", children: run.pluginId ?? "unknown" },
          { key: "source", label: "Source", children: run.source },
          { key: "status", label: "Status", children: <StatusBadge status={run.status} /> },
          { key: "durationMs", label: "Duration", children: `${run.durationMs ?? 0} ms` },
          { key: "createdAt", label: "Created At", children: new Date(run.createdAt).toLocaleString() },
        ]}
      />
      <JsonPanel title="Input JSON" value={run.input} />
      <JsonPanel title="Output" value={run.output} />
      <JsonPanel title="Error" value={run.error} />
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="grid gap-2">
      <Typography.Text strong>{title}</Typography.Text>
      <pre className="m-0 max-h-[280px] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  return JSON.stringify(value, null, 2);
}
