import type { CommandResult } from "@tooldeck/protocol";

import { Badge } from "@/renderer/components/ui/badge";

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
  const variant =
    status === "error" || status === "failed"
      ? "destructive"
      : status === "success" || status === "active"
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}
