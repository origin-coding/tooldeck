import type { CommandResult } from "@tooldeck/protocol";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

export type StatusBadgeStatus =
  | CommandResult["status"]
  | "idle"
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed"
  | "disabled";

export function StatusBadge({ status }: { status: StatusBadgeStatus }) {
  const { t } = useTranslation();
  const color =
    status === "error" || status === "failed"
      ? "error"
      : status === "success" || status === "active"
        ? "success"
        : status === "disabled" || status === "idle" || status === "inactive"
          ? "default"
          : "processing";

  return <Tag color={color}>{t(`status.${status}`)}</Tag>;
}
