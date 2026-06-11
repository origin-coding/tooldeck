import { List, Typography } from "antd";
import { useTranslation } from "react-i18next";

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
  const { i18n, t } = useTranslation();

  if (history.length === 0) {
    return (
      <EmptyState
        text={isLoading ? t("command.historyList.loading") : t("command.historyList.empty")}
      />
    );
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
            description={`${new Date(run.createdAt).toLocaleString(i18n.resolvedLanguage)} · ${
              run.source
            }`}
            title={run.commandId}
          />
        </List.Item>
      )}
    />
  );
}
