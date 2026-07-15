import { Alert, Button, Card, Spin, Typography } from "antd";
import { PackagePlus } from "lucide-react";
import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import type { PluginInstallState } from "@/renderer/app/types";

import { validatePluginPackageDrop, type PluginPackageDropValidation } from "./plugin-package-drop";

export function PluginPackageDropZone({
  installState,
  isLoading,
  onInstall,
  onRescan,
}: {
  installState: PluginInstallState;
  isLoading: boolean;
  onInstall(file: File): void;
  onRescan(): void;
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] =
    useState<Exclude<PluginPackageDropValidation, { valid: true }>["reason"]>();
  const isInstalling = installState.status === "installing";
  const isDisabled = isLoading || isInstalling || installState.status === "refresh-failed";

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isDisabled ? "none" : "copy";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (isDisabled) {
      return;
    }

    const validation = validatePluginPackageDrop(event.dataTransfer.files);

    if (!validation.valid) {
      setValidationError(validation.reason);
      return;
    }

    setValidationError(undefined);
    onInstall(validation.file);
  }

  return (
    <Card title={t("plugin.install.title")}>
      <div
        aria-label={t("plugin.install.dropAriaLabel")}
        className={`grid min-h-36 place-items-center rounded-lg border-2 border-dashed px-5 py-7 text-center transition-colors ${
          isDragging && !isDisabled ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
        } ${isDisabled ? "cursor-not-allowed opacity-70" : "cursor-copy"}`}
        role="region"
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setIsDragging(false);
          }
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="grid justify-items-center gap-2">
          {isInstalling ? (
            <Spin />
          ) : (
            <PackagePlus aria-hidden size={30} className="text-blue-600" />
          )}
          <Typography.Text strong>
            {isInstalling
              ? t("plugin.install.installing", { packageName: installState.packageName })
              : t("plugin.install.dropTitle")}
          </Typography.Text>
          <Typography.Text type="secondary">{t("plugin.install.dropDescription")}</Typography.Text>
        </div>
      </div>

      <PluginInstallNotice
        installState={installState}
        validationError={validationError}
        onRescan={onRescan}
      />
    </Card>
  );
}

function PluginInstallNotice({
  installState,
  validationError,
  onRescan,
}: {
  installState: PluginInstallState;
  validationError?: Exclude<PluginPackageDropValidation, { valid: true }>["reason"];
  onRescan(): void;
}) {
  const { t } = useTranslation();

  if (validationError) {
    return (
      <Alert
        showIcon
        className="mt-3"
        title={t(`plugin.install.validation.${validationError}`)}
        type="error"
      />
    );
  }

  if (installState.status === "success") {
    return (
      <Alert
        showIcon
        className="mt-3"
        title={t("plugin.install.success", { packageName: installState.packageName })}
        type="success"
      />
    );
  }

  if (installState.status === "error") {
    return (
      <Alert
        showIcon
        className="mt-3"
        description={installState.message}
        title={t("plugin.install.failed")}
        type="error"
      />
    );
  }

  if (installState.status === "refresh-failed") {
    return (
      <Alert
        showIcon
        action={
          <Button htmlType="button" onClick={onRescan} size="small">
            {t("common.rescan")}
          </Button>
        }
        className="mt-3"
        description={`${t("plugin.install.refreshFailedDescription")} ${installState.message}`}
        title={t("plugin.install.refreshFailed")}
        type="warning"
      />
    );
  }

  return null;
}
