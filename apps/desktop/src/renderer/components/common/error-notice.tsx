import { Alert } from "antd";

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
    <Alert
      showIcon
      className={compact ? "mb-3" : undefined}
      description={message}
      title={title}
      type="error"
    />
  );
}
