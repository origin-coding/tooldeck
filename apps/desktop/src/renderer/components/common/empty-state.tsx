import { Empty } from "antd";

export function EmptyState({ text, className }: { text: string; className?: string }) {
  return <Empty className={className} description={text} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
}
