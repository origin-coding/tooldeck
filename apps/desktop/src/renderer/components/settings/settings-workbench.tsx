import type { PreferenceScope } from "@tooldeck/shared";
import { Button, Card, Divider, Segmented, Select, Switch, Typography } from "antd";
import { Database, FolderSearch, History, Languages, PanelLeftClose, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DesktopNavigationMode } from "@/renderer/app/types";
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
  navigationMode,
  sidebarCollapsed,
  preferences,
  onOpenHistory,
  onRefresh,
  onSetPreference,
}: {
  commandCount: number;
  pluginCount: number;
  historyCount: number;
  isLoading: boolean;
  navigationMode: DesktopNavigationMode;
  sidebarCollapsed: boolean;
  preferences: DesktopPreference[];
  onOpenHistory(commandId?: string): void;
  onRefresh(): void;
  onSetPreference(scope: PreferenceScope, key: string, value: unknown): void;
}) {
  const { t } = useTranslation();
  const localePreference = preferences.find(
    (preference) => preference.scope === "shared" && preference.key === "locale",
  );
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
        <div className="mt-3.5 grid gap-3.5">
          <div className="flex items-start gap-2.5">
            <Languages size={16} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{t("settings.locale.label")}</div>
                  <Typography.Text type="secondary">
                    {t("settings.locale.description")}
                  </Typography.Text>
                </div>
                <Select
                  className="w-full md:w-[180px]"
                  disabled={isLoading}
                  options={[
                    { label: t("common.system"), value: "system" },
                    { label: t("common.english"), value: "en-US" },
                    { label: t("common.chineseSimplified"), value: "zh-CN" },
                  ]}
                  value={localeValue}
                  onChange={(value: TooldeckLocalePreference) =>
                    onSetPreference("shared", "locale", value)
                  }
                />
              </div>
            </div>
          </div>
          <Divider />
          <div className="flex items-start gap-2.5">
            <FolderSearch size={16} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">Navigation mode</div>
                  <Typography.Text type="secondary">
                    {navigationMode === "provider-first"
                      ? "Browse by plugin, then choose an entry."
                      : "Browse commands and other entries directly."}
                  </Typography.Text>
                </div>
                <Segmented
                  disabled={isLoading}
                  options={[
                    { label: "Provider first", value: "provider-first" },
                    { label: "Entry first", value: "entry-first" },
                  ]}
                  value={navigationMode}
                  onChange={(value) => onSetPreference("desktop", "navigation.mode", value)}
                />
              </div>
            </div>
          </div>
          <Divider />
          <div className="flex items-start gap-2.5">
            <PanelLeftClose size={16} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">Sidebar collapsed</div>
                  <Typography.Text type="secondary">
                    Keep the sidebar collapsed to show icons only.
                  </Typography.Text>
                </div>
                <Switch
                  checked={sidebarCollapsed}
                  disabled={isLoading}
                  onChange={(checked) =>
                    onSetPreference("desktop", "sidebar.collapsed", checked)
                  }
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
            icon={<RotateCw className={isLoading ? "animate-spin" : undefined} size={15} />}
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
        <div className="mt-3.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SettingsMetric label="Plugins" value={pluginCount} />
            <SettingsMetric label="Commands" value={commandCount} />
            <button
              type="button"
              className="grid w-full gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-inherit hover:border-blue-300 hover:bg-blue-50"
              onClick={() => onOpenHistory(undefined)}
            >
              <span className="text-xs text-gray-500">Recent Runs</span>
              <span className="flex items-center justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums">{historyCount}</span>
                <History size={16} />
              </span>
            </button>
          </div>
        </div>
      </Card>

      <Card title="V1 Scope">
        <Typography.Text type="secondary">
          Current desktop settings stay inside the local MVP boundary.
        </Typography.Text>
        <div className="mt-3.5 grid gap-3.5">
          <div className="flex items-start gap-2.5">
            <FolderSearch size={16} />
            <div>
              <div className="font-semibold">Manifest scanning</div>
              <Typography.Text type="secondary">
                Plugin manifests are scanned without activating plugin code.
              </Typography.Text>
            </div>
          </div>
          <Divider />
          <div className="flex items-start gap-2.5">
            <Database size={16} />
            <div>
              <div className="font-semibold">SQLite state</div>
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
    <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <StatusBadge status={value > 0 ? "active" : "idle"} />
      </div>
    </div>
  );
}
