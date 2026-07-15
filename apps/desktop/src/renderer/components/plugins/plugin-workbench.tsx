import { Button, Card, Divider, List, Popconfirm, Typography } from "antd";
import { Power, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PluginInstallState } from "@/renderer/app/types";
import { EmptyCard } from "@/renderer/components/common/empty-card";
import { EmptyState } from "@/renderer/components/common/empty-state";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import type { DesktopCommand, DesktopPlugin, DesktopPluginDataResidue } from "@/shared/desktop-api";

import { PluginPackageDropZone } from "./plugin-package-drop-zone";

export function PluginWorkbench({
  plugin,
  commands,
  installState,
  pluginDataResidues,
  isLoading,
  onInstall,
  onRescan,
  onSelectCommand,
  onSetEnabled,
  onUninstall,
  onPurge,
}: {
  plugin?: DesktopPlugin;
  commands: DesktopCommand[];
  installState: PluginInstallState;
  pluginDataResidues: DesktopPluginDataResidue[];
  isLoading: boolean;
  onInstall(file: File): void;
  onRescan(): void;
  onSelectCommand(command: DesktopCommand): void;
  onSetEnabled(pluginId: string, enabled: boolean): void;
  onUninstall(pluginId: string): void;
  onPurge(pluginId: string): void;
}) {
  const { t } = useTranslation();

  const operationsDisabled =
    isLoading || installState.status === "installing" || installState.status === "refresh-failed";

  return (
    <>
      <PluginPackageDropZone
        installState={installState}
        isLoading={isLoading}
        onInstall={onInstall}
        onRescan={onRescan}
      />

      {pluginDataResidues.length > 0 ? (
        <Card title={t("plugin.retainedData.title")}>
          <Typography.Paragraph type="secondary">
            {t("plugin.retainedData.description")}
          </Typography.Paragraph>
          <List
            dataSource={pluginDataResidues}
            renderItem={(residue) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="purge"
                    cancelText={t("plugin.cancel")}
                    okButtonProps={{ danger: true }}
                    okText={t("plugin.purge")}
                    onConfirm={() => onPurge(residue.pluginId)}
                    title={t("plugin.retainedData.confirmTitle")}
                    description={t("plugin.retainedData.confirmDescription", {
                      pluginId: residue.pluginId,
                    })}
                  >
                    <Button danger disabled={operationsDisabled} icon={<Trash2 size={15} />}>
                      {t("plugin.purge")}
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={residue.pluginId}
                  description={t("plugin.retainedData.summary", {
                    kvEntries: residue.kvEntries,
                    state: residue.statePresent
                      ? t("plugin.retainedData.statePresent")
                      : t("plugin.retainedData.stateAbsent"),
                  })}
                />
              </List.Item>
            )}
          />
        </Card>
      ) : null}

      {!plugin ? (
        <EmptyCard
          title={t("plugin.empty.title")}
          text={isLoading ? t("plugin.empty.loading") : t("plugin.empty.choose")}
        />
      ) : (
        <>
          <Card
            extra={
              <div className="flex items-center gap-2">
                <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
                {plugin.sourceKind === "installed" ? (
                  <Popconfirm
                    cancelText={t("plugin.cancel")}
                    okButtonProps={{ danger: true }}
                    okText={t("plugin.uninstall")}
                    onConfirm={() => onUninstall(plugin.id)}
                    title={t("plugin.uninstallConfirmTitle")}
                    description={t("plugin.uninstallConfirmDescription", {
                      pluginId: plugin.id,
                    })}
                  >
                    <Button danger disabled={operationsDisabled} icon={<Trash2 size={15} />}>
                      {t("plugin.uninstall")}
                    </Button>
                  </Popconfirm>
                ) : null}
                <Button
                  disabled={operationsDisabled}
                  htmlType="button"
                  icon={<Power size={15} />}
                  onClick={() => onSetEnabled(plugin.id, !plugin.enabled)}
                  type={plugin.enabled ? "default" : "primary"}
                >
                  {plugin.enabled ? t("plugin.disable") : t("plugin.enable")}
                </Button>
              </div>
            }
            title={plugin.name}
          >
            <Typography.Text type="secondary">{plugin.description ?? plugin.id}</Typography.Text>
            <div className="mt-3.5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <PluginMeta label={t("plugin.version")} value={plugin.version} />
                <PluginMeta
                  label={t("plugin.source")}
                  value={t(`plugin.sourceKind.${plugin.sourceKind}`)}
                />
                <PluginMeta
                  label={t("plugin.runtime")}
                  value={plugin.enabled ? plugin.runtimeState : t("status.disabled")}
                />
                <PluginMeta label={t("common.commands")} value={String(plugin.commandCount)} />
              </div>
              <Divider />
              <Typography.Text
                className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                type="secondary"
              >
                {plugin.manifestPath}
              </Typography.Text>
            </div>
          </Card>

          <Card title={t("plugin.contributedCommands")}>
            <Typography.Text type="secondary">
              {t("plugin.contributedCommandsDescription")}
            </Typography.Text>
            <div className="mt-3.5">
              {commands.length === 0 ? (
                <EmptyState text={t("plugin.noCommandsContributed")} />
              ) : null}
              {commands.length > 0 ? (
                <div className="grid gap-2">
                  {commands.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      className="grid w-full gap-1 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50"
                      onClick={() => onSelectCommand(command)}
                    >
                      <span className="font-semibold">{command.title}</span>
                      <span className="text-xs text-gray-500">
                        {command.description ?? command.id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function PluginMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}
