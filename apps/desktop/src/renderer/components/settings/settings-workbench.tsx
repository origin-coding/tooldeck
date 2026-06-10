import { Button, Card, Divider, Typography } from "antd";
import { Database, FolderSearch, RotateCw } from "lucide-react";

import { StatusBadge } from "@/renderer/components/common/status-badge";

export function SettingsWorkbench({
  commandCount,
  pluginCount,
  historyCount,
  isLoading,
  onRefresh,
}: {
  commandCount: number;
  pluginCount: number;
  historyCount: number;
  isLoading: boolean;
  onRefresh(): void;
}) {
  return (
    <>
      <Card
        extra={
          <Button
            disabled={isLoading}
            htmlType="button"
            icon={<RotateCw className={isLoading ? "spin-icon" : undefined} size={15} />}
            onClick={onRefresh}
          >
            Rescan
          </Button>
        }
        title="Local Workspace"
      >
        <Typography.Text type="secondary">
          Trusted plugin data for this desktop instance.
        </Typography.Text>
        <div className="section-offset">
          <div className="metrics-grid">
            <SettingsMetric label="Plugins" value={pluginCount} />
            <SettingsMetric label="Commands" value={commandCount} />
            <SettingsMetric label="Recent Runs" value={historyCount} />
          </div>
        </div>
      </Card>

      <Card title="V1 Scope">
        <Typography.Text type="secondary">
          Current desktop settings stay inside the local MVP boundary.
        </Typography.Text>
        <div className="settings-list">
          <div className="settings-list-item">
            <FolderSearch size={16} />
            <div>
              <div className="settings-list-title">Manifest scanning</div>
              <Typography.Text type="secondary">
                Plugin manifests are scanned without activating plugin code.
              </Typography.Text>
            </div>
          </div>
          <Divider />
          <div className="settings-list-item">
            <Database size={16} />
            <div>
              <div className="settings-list-title">SQLite state</div>
              <Typography.Text type="secondary">
                Plugin registry and command run history are persisted as core local state.
              </Typography.Text>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function SettingsMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-box">
      <div className="metric-label">{label}</div>
      <div className="metric-row">
        <div className="metric-number">{value}</div>
        <StatusBadge status={value > 0 ? "active" : "idle"} />
      </div>
    </div>
  );
}
