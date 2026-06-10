import { Button, Card, Divider, Select, Typography } from "antd";
import { Database, FolderSearch, Languages, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/renderer/components/common/status-badge";
import {
  isTooldeckLocalePreference,
  type TooldeckLocalePreference,
} from "@/renderer/i18n";
import type { DesktopPreference } from "@/shared/desktop-api";

export function SettingsWorkbench({
  commandCount,
  pluginCount,
  historyCount,
  isLoading,
  preferences,
  onRefresh,
  onSetPreference,
}: {
  commandCount: number;
  pluginCount: number;
  historyCount: number;
  isLoading: boolean;
  preferences: DesktopPreference[];
  onRefresh(): void;
  onSetPreference(key: string, value: unknown): void;
}) {
  const { t } = useTranslation();
  const localePreference = preferences.find((preference) => preference.key === "locale");
  const localeValue: TooldeckLocalePreference = isTooldeckLocalePreference(
    localePreference?.value,
  )
    ? localePreference.value
    : "system";

  return (
    <>
      <Card title={t("settings.preferences.title")}>
        <Typography.Text type="secondary">
          {t("settings.preferences.description")}
        </Typography.Text>
        <div className="settings-list">
          <div className="settings-list-item">
            <Languages size={16} />
            <div className="settings-control-body">
              <div className="settings-control-row">
                <div>
                  <div className="settings-list-title">{t("settings.locale.label")}</div>
                  <Typography.Text type="secondary">
                    {t("settings.locale.description")}
                  </Typography.Text>
                </div>
                <Select
                  className="settings-select"
                  disabled={isLoading}
                  options={[
                    { label: t("common.system"), value: "system" },
                    { label: t("common.english"), value: "en-US" },
                    { label: t("common.chineseSimplified"), value: "zh-CN" },
                  ]}
                  value={localeValue}
                  onChange={(value: TooldeckLocalePreference) => onSetPreference("locale", value)}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

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
