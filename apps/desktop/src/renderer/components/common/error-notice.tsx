import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/renderer/components/ui/alert";

export function ErrorNotice({
  title,
  message,
  compact = false,
}: {
  title: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <Alert variant="destructive" className={compact ? "mb-3" : undefined}>
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
