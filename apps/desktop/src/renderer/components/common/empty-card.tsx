import { Card, Typography } from "antd";

export function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <Typography.Title level={4}>{title}</Typography.Title>
      <Typography.Text type="secondary">{text}</Typography.Text>
    </Card>
  );
}
