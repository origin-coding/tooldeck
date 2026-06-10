import { List, Typography } from "antd";

import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { CommandRunRecord } from "@/shared/desktop-api";

export function CommandHistory({
  history,
  isLoading,
}: {
  history: CommandRunRecord[];
  isLoading: boolean;
}) {
  if (history.length === 0) {
    return <EmptyState text={isLoading ? "Loading history" : "No command runs"} />;
  }

  return (
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
        >
          <List.Item.Meta
            description={`${new Date(run.createdAt).toLocaleString()} · ${run.source}`}
            title={run.commandId}
          />
        </List.Item>
      )}
    />
  );
}
