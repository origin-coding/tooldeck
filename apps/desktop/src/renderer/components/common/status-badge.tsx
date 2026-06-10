import type { CommandResult } from "@tooldeck/protocol";
import { Tag } from "antd";

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
  const color =
    status === "error" || status === "failed"
      ? "error"
      : status === "success" || status === "active"
        ? "success"
        : status === "disabled" || status === "idle" || status === "inactive"
          ? "default"
          : "processing";

  return <Tag color={color}>{status}</Tag>;
}
